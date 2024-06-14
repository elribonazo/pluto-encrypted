import type {
  RxStorageInstance,
  RxStorageDefaultCheckpoint,
  StringKeys,
  RxDocumentData,
  EventBulk,
  RxStorageChangeEvent,
  RxJsonSchema,
  BulkWriteRow,
  RxStorageBulkWriteResponse,
  RxStorageQueryResult,
  RxStorageCountResult,
  RxConflictResultionTask,
  PreparedQuery,
  RxConflictResultionTaskSolution,
  QueryMatcher,
} from 'rxdb'

import type {
  Observable
} from 'rxjs'

import {
  categorizeBulkWriteRows,
  ensureNotFalsy,
  getPrimaryFieldOfPrimaryKey,
  getQueryMatcher,
  getSortComparator,
  now,
} from 'rxdb'

import {
  Subject
} from 'rxjs'

import type {
  LevelDBStorageInternals,
  LevelDBSettings,
  RxStorageLevelDBType,
} from './types'
import { fixTxPipe } from '@pluto-encrypted/shared'

export class RxStorageIntanceLevelDB<RxDocType> implements RxStorageInstance<
  RxDocType,
  LevelDBStorageInternals<RxDocType>,
  LevelDBSettings,
  RxStorageDefaultCheckpoint> {
  public readonly primaryPath: StringKeys<RxDocumentData<RxDocType>>
  public conflictResultionTasks$ = new Subject<RxConflictResultionTask<RxDocType>>()
  public changes$ = new Subject<EventBulk<RxStorageChangeEvent<RxDocumentData<RxDocType>>, RxStorageDefaultCheckpoint>>()
  public closed: boolean = false

  constructor(
    public readonly storage: RxStorageLevelDBType<RxDocType>,
    public readonly databaseName: string,
    public readonly collectionName: string,
    public readonly schema: Readonly<RxJsonSchema<RxDocumentData<RxDocType>>>,
    public readonly internals: LevelDBStorageInternals<RxDocType>,
    public readonly options: Readonly<LevelDBSettings>
  ) {
    this.primaryPath = getPrimaryFieldOfPrimaryKey(this.schema.primaryKey)
  }

  async bulkWrite(
    documentWrites: BulkWriteRow<RxDocType>[],
    context: string
  ): Promise<RxStorageBulkWriteResponse<RxDocType>> {
    const primaryPath = this.primaryPath
    const ret: RxStorageBulkWriteResponse<RxDocType> = {
      success: [],
      error: []
    }
    const documentKeys: string[] = documentWrites.map(writeRow => writeRow.document[this.primaryPath] as any)
    const documents = await this.internals.getDocuments(documentKeys)

    const fixed = documentWrites.reduce<Array<BulkWriteRow<RxDocType>>>((fixedDocs, currentWriteDoc) => {
      const currentId = currentWriteDoc.document[this.primaryPath] as any
      const previousDocument = currentWriteDoc.previous ?? this.internals.documents.get(currentId)
      if (context === 'data-migrator-delete') {
        if (previousDocument && previousDocument._rev === currentWriteDoc.document._rev) {
          fixedDocs.push(currentWriteDoc)
        }
      } else {
        if (previousDocument && previousDocument._rev !== currentWriteDoc.document._rev) {
          currentWriteDoc.previous = previousDocument
        } else {
          currentWriteDoc.previous = undefined
        }
        fixedDocs.push(currentWriteDoc)
      }
      return fixedDocs
    }, [])

    const categorized = categorizeBulkWriteRows<RxDocType>(
      this,
      primaryPath as any,
      documents,
      fixed,
      context
    )
    ret.error = categorized.errors

    /**
       * Do inserts/updates
       */
    const bulkInsertDocs = categorized.bulkInsertDocs
    for (let i = 0; i < bulkInsertDocs.length; ++i) {
      const writeRow = bulkInsertDocs[i]!
      await this.internals.bulkPut([writeRow.document], this.collectionName, this.schema)
      ret.success.push(writeRow.document)
    }

    const bulkUpdateDocs = categorized.bulkUpdateDocs
    for (let i = 0; i < bulkUpdateDocs.length; ++i) {
      const writeRow = bulkUpdateDocs[i]!
      await this.internals.bulkPut([writeRow.document], this.collectionName, this.schema)
      ret.success.push(writeRow.document)
    }

    if (categorized.eventBulk.events.length > 0) {
      const lastState = ensureNotFalsy(categorized.newestRow).document
      categorized.eventBulk.checkpoint = {
        id: lastState[primaryPath],
        lwt: lastState._meta.lwt
      }
      const endTime = now()
      categorized.eventBulk.events.forEach(event => {
        (event as any).endTime = endTime
      })
      this.changes$.next(categorized.eventBulk)
    }

    return await Promise.resolve(ret)
  }

  async findDocumentsById(ids: string[], withDeleted: boolean): Promise<RxDocumentData<RxDocType>[]> {
    const docs: RxDocumentData<RxDocType>[] = []
    for (const docId of ids) {
      const document = await this.internals.get(docId)
      if (document) {
        docs.push(document)
      }
    }
    return docs
  }

  async query(preparedQuery: PreparedQuery<RxDocType>): Promise<RxStorageQueryResult<RxDocType>> {
    const { queryPlan, query } = preparedQuery
    const selector = query.selector
    const selectorKeys = Object.keys(selector)
    const skip = query.skip ? query.skip : 0
    const limit = query.limit ? query.limit : Infinity
    const skipPlusLimit = skip + limit
    const queryMatcher: QueryMatcher<RxDocumentData<RxDocType>> = getQueryMatcher(
      this.schema,
      query
    )

    const queryPlanFields: string[] = queryPlan.index
    const indexes: string[] = []
    if (queryPlanFields.length === 1) {
      indexes.push(fixTxPipe(queryPlanFields[0]!))
    } else {
      indexes.push(...queryPlanFields.map(field => fixTxPipe(field)))
    }

    const shouldAddCompoundIndexes = this.schema.indexes?.find((index) => {
      if (typeof index === 'string') {
        return indexes.find((index2) => index2 === index)
      } else {
        return index.find((subIndex) => {
          return subIndex === index.find((indexValue) => indexValue === subIndex)
        })
      }
    })

    if (shouldAddCompoundIndexes) {
      indexes.splice(0, indexes.length)
      indexes.push(this.collectionName)
      if (typeof shouldAddCompoundIndexes === 'string') {
        indexes.push(shouldAddCompoundIndexes)
      } else {
        indexes.push(...shouldAddCompoundIndexes)
      }
    } else {
      indexes.unshift(this.collectionName)
    }

    const indexName: string = `[${indexes.join('+')}]`
    const docsWithIndex = await this.internals.getIndex(indexName)
    const documents: Array<RxDocumentData<RxDocType>> = await this.internals.bulkGet(docsWithIndex)
    let filteredDocuments = documents.filter((document) => {
      if (selectorKeys.length <= 0) {
        return true
      } else {
        return queryMatcher(document)
      }
    })

    const sortComparator = getSortComparator(this.schema, preparedQuery.query)
    filteredDocuments = filteredDocuments.sort(sortComparator)

    filteredDocuments = filteredDocuments.slice(skip, skipPlusLimit)
    return {
      documents: filteredDocuments
    }
  }

  async count(preparedQuery: PreparedQuery<RxDocType>): Promise<RxStorageCountResult> {
    const result = await this.query(preparedQuery);
    return {
      count: result.documents.length,
      mode: 'fast'
    }
  }

  getAttachmentData(documentId: string, attachmentId: string, digest: string): Promise<string> {
    throw new Error('Method not implemented.')
  }

  getChangedDocumentsSince?(limit: number, checkpoint?: RxStorageDefaultCheckpoint | undefined): Promise<{ documents: RxDocumentData<RxDocType>[]; checkpoint: RxStorageDefaultCheckpoint }> {
    throw new Error('Method not implemented.')
  }

  changeStream(): Observable<EventBulk<RxStorageChangeEvent<RxDocType>, RxStorageDefaultCheckpoint>> {
    return this.changes$.asObservable()
  }

  async cleanup(minimumDeletedTime: number): Promise<boolean> {
    await this.internals.clear()
    return false
  }

  async close(): Promise<void> {
    if (this.closed) {
      await Promise.resolve();
      return
    }

    await this.internals.close()
    this.changes$.complete()
    this.closed = true
    this.internals.refCount = this.internals.refCount - 1
  }

  async remove(): Promise<void> {
    await Promise.resolve()
  }

  conflictResultionTasks(): Observable<RxConflictResultionTask<RxDocType>> {
    return this.conflictResultionTasks$.asObservable()
  }

  async resolveConflictResultionTask(taskSolution: RxConflictResultionTaskSolution<RxDocType>): Promise<void> {
    await Promise.resolve()
  }


}



// async bulkWrite(
//   documentWrites: Array<BulkWriteRow<RxDocType>>,
//   context: string): Promise<RxStorageBulkWriteResponse<RxDocType>> {
//   const primaryPath = this.primaryPath
//   const ret: RxStorageBulkWriteResponse<RxDocType> = {
//     success: [],
//     error: []
//   }
//   const documentKeys: string[] = documentWrites.map(writeRow => writeRow.document[this.primaryPath] as any)
//   const documents = await this.internals.getDocuments(documentKeys)

//   const fixed = documentWrites.reduce<Array<BulkWriteRow<RxDocType>>>((fixedDocs, currentWriteDoc) => {
//     const currentId = currentWriteDoc.document[this.primaryPath] as any
//     const previousDocument = currentWriteDoc.previous ?? this.internals.documents.get(currentId)
//     if (context === 'data-migrator-delete') {
//       if (previousDocument && previousDocument._rev === currentWriteDoc.document._rev) {
//         fixedDocs.push(currentWriteDoc)
//       }
//     } else {
//       if (previousDocument && previousDocument._rev !== currentWriteDoc.document._rev) {
//         currentWriteDoc.previous = previousDocument
//       } else {
//         currentWriteDoc.previous = undefined
//       }
//       fixedDocs.push(currentWriteDoc)
//     }
//     return fixedDocs
//   }, [])

//   const categorized = categorizeBulkWriteRows<RxDocType>(
//     this,
//     primaryPath as any,
//     documents,
//     fixed,
//     context
//   )
//   ret.error = categorized.errors

//   /**
//      * Do inserts/updates
//      */
//   const bulkInsertDocs = categorized.bulkInsertDocs
//   for (let i = 0; i < bulkInsertDocs.length; ++i) {
//     const writeRow = bulkInsertDocs[i]!
//     const docId = writeRow.document[primaryPath]
//     await this.internals.bulkPut([writeRow.document], this.collectionName, this.schema)
//     ret.success.push(writeRow.document)
//   }

//   const bulkUpdateDocs = categorized.bulkUpdateDocs
//   for (let i = 0; i < bulkUpdateDocs.length; ++i) {
//     const writeRow = bulkUpdateDocs[i]!
//     const docId = writeRow.document[primaryPath]
//     await this.internals.bulkPut([writeRow.document], this.collectionName, this.schema)
//     ret.success.push(writeRow.document)
//   }

//   if (categorized.eventBulk.events.length > 0) {
//     const lastState = ensureNotFalsy(categorized.newestRow).document
//     categorized.eventBulk.checkpoint = {
//       id: lastState[primaryPath],
//       lwt: lastState._meta.lwt
//     }
//     const endTime = now()
//     categorized.eventBulk.events.forEach(event => {
//       (event as any).endTime = endTime
//     })
//     this.changes$.next(categorized.eventBulk)
//   }

//   return await Promise.resolve(ret)
// }

// async findDocumentsById(ids: string[]): Promise<RxDocumentDataById<RxDocType>> {
//   const docs: RxDocumentDataById<RxDocType> = {}
//   for (const docId of ids) {
//     const document = await this.internals.get(docId)
//     if (document) {
//       docs[docId] = document
//     }
//   }
//   return docs
// }

// async query(preparedQuery: LevelDBPreparedQuery<RxDocType>): Promise<RxStorageQueryResult<RxDocType>> {
//   const { queryPlan, query } = preparedQuery
//   const selector = query.selector
//   const selectorKeys = Object.keys(selector)
//   const skip = query.skip ? query.skip : 0
//   const limit = query.limit ? query.limit : Infinity
//   const skipPlusLimit = skip + limit
//   const queryMatcher: QueryMatcher<RxDocumentData<RxDocType>> = getQueryMatcher(
//     this.schema,
//     query
//   )

//   const queryPlanFields: string[] = queryPlan.index
//   const indexes: string[] = []
//   if (queryPlanFields.length === 1) {
//     indexes.push(fixTxPipe(queryPlanFields[0]!))
//   } else {
//     indexes.push(...queryPlanFields.map(field => fixTxPipe(field)))
//   }

//   const shouldAddCompoundIndexes = this.schema.indexes?.find((index) => {
//     if (typeof index === 'string') {
//       return indexes.find((index2) => index2 === index)
//     } else {
//       return index.find((subIndex) => {
//         return subIndex === index.find((indexValue) => indexValue === subIndex)
//       })
//     }
//   })

//   if (shouldAddCompoundIndexes) {
//     indexes.splice(0, indexes.length)
//     indexes.push(this.collectionName)
//     if (typeof shouldAddCompoundIndexes === 'string') {
//       indexes.push(shouldAddCompoundIndexes)
//     } else {
//       indexes.push(...shouldAddCompoundIndexes)
//     }
//   } else {
//     indexes.unshift(this.collectionName)
//   }

//   const indexName: string = `[${indexes.join('+')}]`
//   const docsWithIndex = await this.internals.getIndex(indexName)
//   const documents: Array<RxDocumentData<RxDocType>> = await this.internals.bulkGet(docsWithIndex)
//   let filteredDocuments = documents.filter((document) => {
//     if (selectorKeys.length <= 0) {
//       return true
//     } else {
//       return queryMatcher(document)
//     }
//   })

//   const sortComparator = getSortComparator(this.schema, preparedQuery.query)
//   filteredDocuments = filteredDocuments.sort(sortComparator)

//   filteredDocuments = filteredDocuments.slice(skip, skipPlusLimit)
//   return {
//     documents: filteredDocuments
//   }
//   // let indexOfLower = (queryPlan.inclusiveStart ? boundGE : boundGT)(
//   //     docsWithIndex,
//   //     {
//   //         indexString: lowerBoundString
//   //     } as any,
//   //     compareDocsWithIndex
//   // );
//   // const indexOfUpper = (queryPlan.inclusiveEnd ? boundLE : boundLT)(
//   //     docsWithIndex,
//   //     {
//   //         indexString: upperBoundString
//   //     } as any,
//   //     compareDocsWithIndex
//   // );

//   // let rows: RxDocumentData<RxDocType>[] = [];
//   // let done = false;
//   // while (!done) {
//   //     const currentRow = docsWithIndex[indexOfLower] as any;
//   //     if (
//   //         !currentRow ||
//   //         indexOfLower > indexOfUpper
//   //     ) {
//   //         break;
//   //     }
//   //     const currentDoc = currentRow.doc;

//   //     if (!queryMatcher || queryMatcher(currentDoc)) {
//   //         rows.push(currentDoc);
//   //     }

//   //     if (
//   //         (rows.length >= skipPlusLimit && !mustManuallyResort) ||
//   //         indexOfLower >= docsWithIndex.length
//   //     ) {
//   //         done = true;
//   //     }

//   //     indexOfLower++;
//   // }

//   // if (mustManuallyResort) {
//   //     const sortComparator = getSortComparator(this.schema, preparedQuery.query);
//   //     rows = rows.sort(sortComparator);
//   // }

//   // // apply skip and limit boundaries.
//   // rows = rows.slice(skip, skipPlusLimit);
//   // return Promise.resolve({
//   //     documents: rows
//   // })
// }

// async count(preparedQuery: LevelDBPreparedQuery<RxDocType>): Promise<RxStorageCountResult> {
//   const result = await this.query(preparedQuery)
//   return {
//     count: result.documents.length,
//     mode: 'fast'
//   }
// }

// /* istanbul ignore next */
// async getAttachmentData(): Promise<string> {
//   throw new Error('Method not implemented.')
// }

// /* istanbul ignore next */
// async getChangedDocumentsSince(): Promise<{ documents: Array<RxDocumentData<RxDocType>>, checkpoint: RxStorageDefaultCheckpoint }> {
//   throw new Error('Method not implemented.')
// }

// /* istanbul ignore next */
// changeStream(): Observable<EventBulk<RxStorageChangeEvent<RxDocType>, RxStorageDefaultCheckpoint>> {
//   return this.changes$.asObservable()
// }

// async cleanup(): Promise<boolean> {
//   await this.internals.clear()
//   return false
// }

// /* istanbul ignore next */
// async close(): Promise<void> {
//   if (this.closed) {
//     await Promise.resolve(); return
//   }

//   await this.internals.close()
//   this.changes$.complete()
//   this.closed = true
//   this.internals.refCount = this.internals.refCount - 1
// }

// /* istanbul ignore next */
// async remove(): Promise<void> {
//   await Promise.resolve()
// }

// conflictResultionTasks(): Observable<RxConflictResultionTask<RxDocType>> {
//   return this.conflictResultionTasks$.asObservable()
// }

// /* istanbul ignore next */
// async resolveConflictResultionTask(): Promise<void> {
//   await Promise.resolve()
// }