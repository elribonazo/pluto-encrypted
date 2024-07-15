import { type RxDocumentData, type RxJsonSchema, getPrimaryFieldOfPrimaryKey } from 'rxdb'
import Level from 'level'
import pull from 'pull-stream'
import pullLevel from 'pull-level'

import {
  type LevelDBStorageInternals,
  type LevelDBInternalConstructor,
  type LevelDBType
} from './types'
import { getPrivateKeyValue, safeIndexList } from '@pluto-encrypted/shared'

export class LevelDBInternal<RxDocType> implements LevelDBStorageInternals<RxDocType> {
  public removed = false
  public refCount: number
  private readonly db: LevelDBType
  public documents: Map<string, RxDocumentData<RxDocType>>
  public schema: RxJsonSchema<RxDocumentData<RxDocType>>

  static isLevelDBConstructor<RxDocType>(_options: LevelDBInternalConstructor<RxDocType>): _options is {
    level: LevelDBType
    refCount: number
    schema: RxJsonSchema<RxDocumentData<RxDocType>>
    documents?: Map<string, RxDocumentData<RxDocType>>
  } {
    return 'level' in _options && _options.level !== undefined
  }

  constructor(private readonly _options: LevelDBInternalConstructor<RxDocType>) {
    this.refCount = this._options.refCount
    this.schema = this._options.schema
    this.documents = this._options.documents ?? new Map()
    if (LevelDBInternal.isLevelDBConstructor(this._options)) {
      this.db = this._options.level
    } else {
      this.db = Level(this._options.dbPath, { valueEncoding: 'json' })
    }
  }

  async getDocuments(query: string[]): Promise<Map<string, RxDocumentData<RxDocType>>> {
    const docsInDbMap = new Map<string, RxDocumentData<RxDocType>>()
    if (query.length <= 0) {
      const db = await this.getInstance()

      await pull(
        pullLevel.read(db),
        pull.filter(row => row && !row.value.match(/^\[.*\]$/)),
        pull.map(row => {
          docsInDbMap.set(row.key, JSON.parse(row.value))
          return row
        }),
        pull.collectAsPromise()
      )

      return docsInDbMap
    }

    const documents = await this.bulkGet(query)
    const primaryPath = getPrimaryFieldOfPrimaryKey(this.schema.primaryKey)
    documents.forEach((document) => {
      docsInDbMap.set(document[primaryPath] as any, document)
      this.documents.set(document[primaryPath] as any, document)
    })
    return docsInDbMap
  }

  async getInstance() {
    await this.db.open()
    return this.db
  }

  async getIndex(key: string): Promise<string[]> {
    console.log('getIndex', key)
    const db = await this.getInstance()
    return db.get(key)
      .then(result => result ? JSON.parse(result) : [])
      .catch(err => {
        /* istanbul ignore else -- @preserve */
        if (err.message.startsWith('Key not found in database')) {
          return []
        } else {
          throw err
        }
      })
  }

  async bulkGet(keys: string[]): Promise<Array<RxDocumentData<RxDocType>>> {
    if (!keys || keys.length <= 0) {
      return []
    }

    const db = await this.getInstance()
    const keysSet = new Set(keys)
    return pull(
      pullLevel.read(db),
      pull.filter(row => (
        keysSet.has(row.key) &&
        row.value !== undefined
      )),
      pull.map(row => JSON.parse(row.value)),
      pull.collectAsPromise()
    )
  }

  async get(key: string): Promise<RxDocumentData<RxDocType> | null> {
    const db = await this.getInstance()
    return await db.get(key)
      .then(result => result ? JSON.parse(result) : null)
      .catch(err => {
        /* istanbul ignore else -- @preserve */
        if (err.message.startsWith('Key not found in database')) {
          return null
        } else {
          throw err
        }
      })
  }

  async set(key: string, data: RxDocumentData<RxDocType>) {
    const db = await this.getInstance()
    await new Promise<void>((resolve, reject) => {
      db.put(key, JSON.stringify(data), (err) => {
        if (err) {
          reject(err); return
        }
        resolve()
      })
    })
  }

  async setIndex(key: string, ids: string[]) {
    console.log('setIndex', key, ids)
    // QUESTION: why is the value being store in the key?
    // QUESTION: if setIndex + getIndex are misaligned...
    //  - then how do we know what these functions SHOULD be doing?
    //
    //  setIndex {
    //    key: '[gbqkcmutflft+false+1barfoopanichbniqax]',
    //    ids: [ '1barfoopanichbniqax' ]
    //  }

    //  setIndex {
    //    key: '[gbqkcmutflft+1720146854091.01+1barfoopanichbniqax]',
    //    ids: [ '1barfoopanichbniqax' ]
    //  }
    const db = await this.getInstance()
    await new Promise<void>((resolve, reject) => {
      db.put(key, JSON.stringify(ids), (err) => {
        if (err) {
          reject(err); return
        }
        resolve()
      })
    })
  }

  async delete(key: string) {
    const db = await this.getInstance()
    await new Promise<void>((resolve, reject) => {
      db.del(key, (err) => {
        if (err) {
          reject(err); return
        }
        resolve()
      })
    })
  }

  async updateIndex(key: string, id: string) {
    const existingIndex = await this.getIndex(key)
    const newIndexes = Array.from(new Set([...existingIndex, id]))
    await this.setIndex(key, newIndexes)
  }

  async removeFromIndex(key: string, id: string) {
    const existingIndex = await this.getIndex(key)
    await this.setIndex(key, existingIndex.filter((vId) => vId !== id))
  }

  async clear() {
    const db = await this.getInstance();
    return new Promise<void>((resolve, reject) => {
      db.clear({}, (err) => {
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }

  async close() {
    const db = await this.getInstance();
    return new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }

  private getField(item: RxDocumentData<RxDocType>, fieldName: string) {
    const splitFieldName = fieldName.split(".");
    let value
    while (splitFieldName.length) {
      const [name] = splitFieldName.splice(0, 1);
      if (name && item[name] !== undefined) {
        value = item[name]
      } else if (name && value && value[name] !== undefined) {
        value = value[name]
      }
    }
    return value;
  }

  private encapsulateIndex(item: RxDocumentData<RxDocType>, collectionName: string, requiredIndexes: string[]) {
    return `[${collectionName}+${requiredIndexes.map((fieldName) => this.getField(item, fieldName)).join("+")}]`
  }

  async bulkPut(items: Array<RxDocumentData<RxDocType>>, collectionName: string, schema: Readonly<RxJsonSchema<RxDocumentData<RxDocType>>>) {
    try {
      const primaryKeyKey = typeof schema.primaryKey === 'string' ? schema.primaryKey : schema.primaryKey.key
      const saferIndexList = safeIndexList(schema)
      for (const item of items) {
        const shouldDelete = item._deleted
        const id = getPrivateKeyValue(item, schema)
        if (shouldDelete) {
          for (const requiredIndexes of saferIndexList) {
            const requiredIndex = this.encapsulateIndex(item, collectionName, requiredIndexes)
            await this.removeFromIndex(requiredIndex, id)
          }
          await this.removeFromIndex(`[${collectionName}+${primaryKeyKey}]`, id)
          await this.removeFromIndex('[all]', id)
          await this.delete(id)
          this.documents.delete(id)
        } else {
          for (const requiredIndexes of saferIndexList) {
            const requiredIndex = this.encapsulateIndex(item, collectionName, requiredIndexes)
            await this.updateIndex(requiredIndex, id)
          }
          await this.updateIndex(`[${collectionName}+${primaryKeyKey}]`, id)
          await this.updateIndex('[all]', id)
          await this.set(id, item)
          this.documents.set(id, item)
        }
      }
    } catch (err) {
      console.log(err);
    }
  }
}
