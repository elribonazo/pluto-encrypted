/**
 * @packageDocumentation
 * @module test-suite
 * @description This package can be used as a compliance test to validate a new storage created by you or the community.
 */
import assert from 'assert';
import type {
  FilledMangoQuery,
  RxDocumentData,
  RxDocumentWriteData,
  RxJsonSchema,
  RxStorageBulkWriteResponse,
} from 'rxdb'
import {
  clone,
  createRevision,
  ensureNotFalsy,
  fillWithDefaultSettings,
  flatCloneDocWithMeta,
  getPseudoSchemaForVersion,
  getQueryMatcher,
  getSortComparator,
  normalizeMangoQuery,
  now,
  parseRevision,
  randomCouchString,
  shuffleArray
} from 'rxdb'
import omit from 'lodash.omit'
import type {
  NestedDoc,
  OptionalValueTestDoc,
  RandomDoc,
  RxTestStorage,
  TestDocType,
  TestSuite,
} from './helper'
import {
  EXAMPLE_REVISION_1,
  EXAMPLE_REVISION_2,
  EXAMPLE_REVISION_3,
  EXAMPLE_REVISION_4,
  getNestedDocSchema,
  getTestDataSchema,
  getWriteData,
  prepareQuery,
  testContext,
  testCorrectQueries,
  withIndexes
} from './helper'
import * as schemas from './helper/schemas'
import type {
  HeroArrayDocumentType,
  NestedHumanDocumentType,
  SimpleHumanV3DocumentType,
} from './helper/schema-objects'
import {
  human,
  nestedHuman,
  simpleHumanV3
} from './helper/schema-objects'
import type {
  HumanDocumentType
} from './helper/schemas'
import {
  randomString
} from 'async-test-util'
import {
  schemaObjects
} from 'rxdb/plugins/test-utils'

export function runTestSuite(suite: TestSuite, testStorage: RxTestStorage): void {
  const { describe, it } = suite

  // tests out the storage module
  describe('RxStorageInstance', () => {
    describe('creation (single instance)', () => {
      it('open many instances on the same database name', async () => {
        const databaseName = randomCouchString(12)
        const amount = 20
  
        for (let i = 0; i < amount; i++) {
          const _storageInstance = await testStorage.getStorage().createStorageInstance<TestDocType>({
            databaseInstanceToken: randomCouchString(10),
            databaseName,
            collectionName: randomCouchString(12),
            schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
            options: {},
            multiInstance: true,
            devMode: false,
            password: randomCouchString(24)
          })
  
          await _storageInstance.cleanup(Infinity)
          await _storageInstance.close()
        }
      })
    
      it('open and close', async ({ expect }) => {
        const collectionName = randomCouchString(12)
        const databaseName = randomCouchString(12)
        const _storage = await testStorage.getStorage()
        const storageInstance = await _storage.createStorageInstance<TestDocType>({
          databaseInstanceToken: randomCouchString(10),
          databaseName,
          collectionName,
          schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
          options: {},
          multiInstance: true,
          devMode: false,
          password: randomCouchString(24)
        })
        expect(storageInstance.collectionName).toBe(collectionName)
        expect(storageInstance.databaseName).toBe(databaseName)

        await storageInstance.cleanup(Infinity)
        // await storageInstance.close()
      })
    })
  })

  describe('.bulkWrite()', () => {
    it('should write the document', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      const pkey = 'foobar'
      const docData: RxDocumentWriteData<TestDocType> = {
        key: pkey,
        value: 'barfoo1',
        _deleted: false,
        _meta: {
          lwt: now()
        },
        _rev: EXAMPLE_REVISION_1,
        _attachments: {}
      }
      const writeResponse = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )
      expect(writeResponse.error).toStrictEqual([])
      const first = writeResponse.success.at(0);
      expect(docData).toStrictEqual(first)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('should error on conflict', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      const pkey = 'foobar'
      const writeData: RxDocumentWriteData<TestDocType> = {
        key: pkey,
        value: 'barfoo',
        _deleted: false,
        _attachments: {},
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }

      await storageInstance.bulkWrite(
        [{
          document: writeData
        }],
        testContext
      )
      const writeResponse = await storageInstance.bulkWrite(
        [{
          document: writeData
        }],
        testContext
      )

      expect(writeResponse.success).toStrictEqual([])
      expect(writeResponse.error.at(0)).not.toBe(undefined)
      const first = writeResponse.error.at(0)!

      expect(first.status).toBe(409)
      expect(first.documentId).toBe(pkey)

      /**
       * The conflict error state must contain the
       * document state in the database.
       * This ensures that we can continue resolving the conflict
       * without having to pull the document out of the db first.
       */
      expect((first as any).documentInDb.value).toBe(writeData.value)

      /**
       * The documentInDb must not have any additional attributes.
       * Some RxStorage implementations store meta fields
       * together with normal document data.
       * These fields must never be leaked to 409 conflict errors
       */
      expect(Object.keys((first as any).documentInDb).sort()).toStrictEqual(Object.keys(writeData).sort())

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('when inserting the same document at the same time, the first call must succeed while the second has a conflict', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      const pkey = 'foobar'
      const writeData: RxDocumentWriteData<TestDocType> = {
        key: pkey,
        value: 'barfoo',
        _deleted: false,
        _attachments: {},
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }

      const first = await storageInstance.bulkWrite(
        [{
          document: Object.assign({}, writeData, {
            value: 'first'
          })
        }],
        testContext
      )

      const second = await storageInstance.bulkWrite(
        [{
          document: Object.assign({}, writeData, {
            value: 'second'
          })
        }],
        testContext
      )

      expect(first.error).toStrictEqual([])
      expect(first.success.at(0)!.value).toBe('first')
      expect(second.error.at(0)!.status).toBe(409)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('should not find the deleted document when findDocumentsById(false)', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const pkey = 'foobar'
      // make an insert
      const insertData = {
        key: pkey,
        value: 'barfoo1',
        _deleted: false,
        _rev: EXAMPLE_REVISION_1,
        _attachments: {},
        _meta: {
          lwt: now()
        }
      }
      const insertResponse = await storageInstance.bulkWrite(
        [{
          document: insertData
        }],
        testContext
      )

      expect(insertResponse.error).toStrictEqual([])
      const first = insertResponse.success.at(0)!

      // make an update
      const updateData = Object.assign({}, insertData, {
        value: 'barfoo2',
        _rev: EXAMPLE_REVISION_2,
        _meta: {
          lwt: now()
        }
      })

      const updateResponse = await storageInstance.bulkWrite(
        [{
          previous: insertData,
          document: updateData
        }],
        testContext
      )

      expect(updateResponse.error).toStrictEqual([])

      // make the delete
      const toDelete = {
        previous: updateData,
        document: Object.assign({}, first, {
          value: 'barfoo_deleted',
          _deleted: true,
          _rev: EXAMPLE_REVISION_3,
          _meta: {
            lwt: now(),
          }
        })
      }

      const deleteResponse = await storageInstance.bulkWrite(
        [toDelete],
        testContext
      )

      expect(deleteResponse.error).toStrictEqual([])

      const foundDoc = await storageInstance.findDocumentsById([pkey], false)

      expect(foundDoc).toStrictEqual([])

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('should be able to unset a property', async ({ expect }) => {
      const schema = getTestDataSchema()
      schema.required = ['key']

      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<OptionalValueTestDoc>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: schema as any,
        options: {},
        multiInstance: true,
        devMode: false
      })
      const docId = randomString(10)
      const insertData: RxDocumentWriteData<OptionalValueTestDoc> = {
        key: docId,
        value: 'barfoo1',
        _attachments: {},
        _deleted: false,
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }
      const writeResponse = await storageInstance.bulkWrite(
        [{
          document: clone(insertData)
        }],
        testContext
      )

      expect(writeResponse.error).toStrictEqual([])
      const insertResponse = writeResponse.success.at(0);
      expect(insertData).toStrictEqual(insertResponse)
      
      const insertDataAfterWrite: RxDocumentData<OptionalValueTestDoc> = Object.assign(
        {},
        insertResponse,
        {
          _rev: insertResponse!._rev
        }
      )
      const updateResponse = await storageInstance.bulkWrite(
        [{
          previous: insertDataAfterWrite,
          document: {
            key: docId,
            _attachments: {},
            _deleted: false,
            _rev: EXAMPLE_REVISION_2,
            _meta: {
              lwt: now(),
            }
          }
        }],
        testContext
      )
      expect(updateResponse.success.at(0)).not.toBe(undefined)
      expect(updateResponse.error).toStrictEqual([])

      const updateResponseDoc = omit(
        updateResponse.success.at(0),
        ['_deleted', '_rev', '_meta']
      )

      expect(updateResponseDoc).toStrictEqual({
        key: docId,
        _attachments: {}
      })

      await storageInstance.cleanup(Infinity)
    })

    it('should be able to do a write where only _meta fields are changed', async ({ expect }) => {
      const databaseInstanceToken = randomCouchString(10)

      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken,
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const key = 'foobar'
      let docData: RxDocumentData<TestDocType> = {
        key,
        value: 'barfoo1',
        _attachments: {},
        _deleted: false,
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now(),
          foobar: 0
        }
      }
      docData._rev = createRevision(databaseInstanceToken)

      const res1 = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )
      expect(res1.error).toStrictEqual([])

      // change once
      let newDocData: RxDocumentData<TestDocType> = clone(docData)
      newDocData._meta.foobar = 1
      newDocData._meta.lwt = now()
      newDocData._rev = createRevision(databaseInstanceToken, docData)

      const res2 = await storageInstance.bulkWrite(
        [{
          previous: docData,
          document: clone(newDocData)
        }],
        testContext
      )
      expect(res2.error).toStrictEqual([])
      docData = newDocData

      // change again
      newDocData = clone(docData)
      newDocData._meta.foobar = 2
      newDocData._meta.lwt = now()
      newDocData._rev = createRevision(databaseInstanceToken, docData)

      expect(parseRevision(newDocData._rev).height).toBe(3)

      const res3 = await storageInstance.bulkWrite(
        [{
          previous: docData,
          document: clone(newDocData)
        }],
        testContext
      )
      expect(res3.error).toStrictEqual([])

      docData = newDocData

      const viaStorage = await storageInstance.findDocumentsById([key], true)
      const viaStorageDoc = ensureNotFalsy(viaStorage.at(0))
      expect(parseRevision(viaStorageDoc._rev).height).toBe(3)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('should be able to create another instance after a write', async ({ expect }) => {
      const databaseName = randomCouchString(12)
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName,
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const pkey = randomCouchString(12)
      const value1 = 'barfoo1'
    
      const docData: RxDocumentWriteData<TestDocType> = {
        key: pkey,
        value: value1,
        _attachments: {},
        _deleted: false,
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }
    
      const writeResponse = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )

      expect(writeResponse.error).toStrictEqual([])
      const first = writeResponse.success.at(0);
      expect(docData).toStrictEqual(first)


      const storageInstance2 = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName,
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      await storageInstance2.bulkWrite(
        [{
          document: Object.assign(
            clone(docData),
            {
              _rev: EXAMPLE_REVISION_2
            }
          )
        }],
        testContext
      )

      await Promise.all([
        storageInstance2.cleanup(Infinity).then(async () => { await storageInstance2.close() })
      ])

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('should be able to jump more then 1 revision height in a single write operation', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      const pkey = 'foobar'
      const docData: RxDocumentData<TestDocType> = {
        key: pkey,
        value: 'barfoo1',
        _deleted: false,
        _meta: {
          lwt: now()
        },
        _rev: EXAMPLE_REVISION_1,
        _attachments: {}
      }
      const insertResponse = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )
      expect(insertResponse.error).toStrictEqual([])

      // update
      const updated = flatCloneDocWithMeta(docData)
      updated.value = 'barfoo2'
      updated._meta.lwt = now()
      updated._rev = EXAMPLE_REVISION_4
      const updateResponse = await storageInstance.bulkWrite(
        [{
          previous: docData,
          document: updated
        }],
        testContext
      )

      expect(updateResponse.error).toStrictEqual([])

      // find again
      const getDocFromDb = await storageInstance.findDocumentsById([docData.key], false)

      expect(getDocFromDb.at(0)).not.toBe(undefined)
      const docFromDb = getDocFromDb.at(0)!

      expect(docFromDb._rev).toEqual(EXAMPLE_REVISION_4)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })

    it('must be able create multiple storage instances on the same database and write documents', async () => {
      const collectionsAmount = 3
      const docsAmount = 3
      const databaseName = randomCouchString(10)
      const databaseInstanceToken = randomCouchString(10)

      await Promise.all(
        new Array(collectionsAmount)
          .fill(0)
          .map(async () => {
            const _storage = await testStorage.getStorage()
            const storageInstance = await _storage.createStorageInstance<TestDocType>({
              databaseInstanceToken,
              databaseName,
              collectionName: randomCouchString(12),
              schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
              options: {},
              multiInstance: true,
              devMode: false
            })
            await Promise.all(
              new Array(docsAmount)
                .fill(0)
                .map(async (_v, docId) => {
                  const writeData: RxDocumentWriteData<TestDocType> = {
                    key: `${docId}`,
                    value: randomCouchString(5),
                    _rev: EXAMPLE_REVISION_1,
                    _deleted: false,
                    _meta: {
                      lwt: now()
                    },
                    _attachments: {}
                  }
                  await storageInstance.bulkWrite([{ document: writeData }], testContext)
                })
            )
            return storageInstance
          })
      )
      // TODO: do we need to tidy up and close these instances?
      // await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    }, { timeout: 200000 })
  
    // Some storages had problems storing non-utf-8 chars like "é"
    it('write and read with umlauts', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })
      const umlauts = 'äöüßé'
      const pkey = 'foobar' + umlauts
      // insert
      const docData: RxDocumentData<TestDocType> = {
        key: pkey,
        value: 'value' + umlauts,
        _deleted: false,
        _meta: {
          lwt: now()
        },
        _rev: EXAMPLE_REVISION_1,
        _attachments: {}
      }
      const insertResponse = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )

      expect(insertResponse.error).toStrictEqual([])

      // find again
      const getDocFromDb = await storageInstance.findDocumentsById([docData.key], false)

      expect(getDocFromDb.at(0)).not.toBe(undefined)

      const docFromDb = getDocFromDb.at(0)

      // TODO: linter doesnt like this line
      if (docFromDb) expect(docFromDb.value).toBe('value' + umlauts)

      const pkey2 = 'foobar2' + umlauts
      // store another doc
      const docData2: RxDocumentData<TestDocType> = {
        key: pkey2,
        value: 'value2' + umlauts,
        _deleted: false,
        _meta: {
          lwt: now()
        },
        _rev: EXAMPLE_REVISION_1,
        _attachments: {}
      }
      await storageInstance.bulkWrite(
        [{
          document: clone(docData2)
        }],
        testContext
      )
      const getDocFromDb2 = await storageInstance.findDocumentsById([docData2.key], false)

      expect(getDocFromDb2.at(0)).not.toBe(undefined)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })
  })

  describe('.getSortComparator()', () => {
    it('should sort in the correct order', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<{
        _id: string
        age: number
      }>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: fillWithDefaultSettings({
          version: 0,
          type: 'object',
          primaryKey: '_id',
          properties: {
            _id: {
              type: 'string',
              maxLength: 100
            },
            age: {
              type: 'number'
            }
          },
          required: [
            '_id',
            'age'
          ]
        }),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const query: FilledMangoQuery<any> = {
        selector: {},
        limit: 1000,
        sort: [
          { age: 'asc' }
        ],
        skip: 0
      }
      const comparator = getSortComparator(
        storageInstance.schema,
        query
      )

      const doc1: any = human()
      doc1._id = 'aa'
      doc1.age = 1
      const doc2: any = human()
      doc2._id = 'bb'
      doc2.age = 100

      // should sort in the correct order
      expect([doc1, doc2]).toStrictEqual([doc1, doc2].sort(comparator))

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })
  
    it('should still sort in correct order when docs do not match the selector', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getTestDataSchema(),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const matchingValue = 'foobar'
      const query: FilledMangoQuery<TestDocType> = {
        selector: {
          value: {
            $eq: matchingValue
          }
        },
        sort: [
          { key: 'asc' }
        ],
        skip: 0
      }

      const comparator = getSortComparator(
        storageInstance.schema,
        query
      )

      const docs: TestDocType[] = [
        {
          value: matchingValue,
          key: 'aaa'
        },
        {
          value: 'barfoo',
          key: 'bbb'
        }
      ]

      const result = comparator(
        docs[0]!,
        docs[1]!

      )

      expect(result).toStrictEqual(-1)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })
  
    it('should work with a more complex query', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getTestDataSchema(),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const matchingValue = 'aaa'
      const query: FilledMangoQuery<TestDocType> = {
        selector: {
          $or: [
            {
              value: matchingValue,
              key: matchingValue
            },
            {
              value: 'barfoo',
              key: 'barfoo'
            }
          ],
          key: matchingValue
        },
        sort: [
          { key: 'asc' }
        ],
        skip: 0
      }

      const comparator = getSortComparator(
        storageInstance.schema,
        query
      )

      const docs: TestDocType[] = [
        {
          value: matchingValue,
          key: matchingValue
        },
        {
          value: 'bbb',
          key: 'bbb'
        }
      ]

      const result = comparator(
        docs[0]!,
        docs[1]!

      )

      expect(result).toStrictEqual(-1)

      await storageInstance.cleanup(Infinity)
      // await storageInstance.close()
    })
  })

  describe('.getQueryMatcher()', () => {
    it('should match the right docs', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<schemas.HumanDocumentType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion(0, '_id' as any),
        options: {},
        multiInstance: true,
        devMode: false
      });

      const query: FilledMangoQuery<HumanDocumentType> = {
        selector: {
          age: {
            $gt: 10,
            $ne: 50
          }
        },
        sort: [
          { _id: 'asc' }
        ],
        skip: 0
      };
      const matcher = getQueryMatcher(
        storageInstance.schema,
        query
      );
      const doc1: any = schemaObjects.humanData();
      doc1._id = 'aa';
      doc1.age = 1;
      const doc2: any = schemaObjects.humanData();
      doc2._id = 'bb';
      doc2.age = 100;

      assert.strictEqual(matcher(doc1), false);
      assert.strictEqual(matcher(doc2), true);

      const schema = getNestedDocSchema()
      const query2: FilledMangoQuery<NestedDoc> = {
        selector: {
          'nes.ted': {
            $eq: 'barfoo'
          }
        },
        sort: [
          { id: 'asc' }
        ],
        skip: 0
      }

      const queryMatcher = getQueryMatcher(
        schema,
        normalizeMangoQuery(schema, query2)
      )

      const notMatchingDoc = {
        id: 'foobar',
        nes: {
          ted: 'xxx'
        },
        _deleted: false,
        _attachments: {},
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }
      const matchingDoc = {
        id: 'foobar',
        nes: {
          ted: 'barfoo'
        },
        _deleted: false,
        _attachments: {},
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }

      expect(queryMatcher(notMatchingDoc)).toStrictEqual(false)
      expect(queryMatcher(matchingDoc)).toStrictEqual(true)

      await storageInstance.cleanup(Infinity)
      // storageInstance.remove();
      // await storageInstance.close()
    })
  })
  

  describe('.query()', () => {
    // TODO: this test is failing with leveldb
    it('should find all documents', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<{ key: string, value: string }>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<{ key: string, value: string }>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })

      async function writeDoc (value) {
        const pkey = value.concat(randomCouchString(12))

        const writeData = {
          key: pkey,
          value,
          _deleted: false,
          _attachments: {},
          _rev: EXAMPLE_REVISION_1,
          _meta: {
            lwt: now()
          }
        }

        const writeResponse = await storageInstance.bulkWrite(
          [{
            document: clone(writeData)
          }],
          testContext
        )

        expect(writeResponse.error).toStrictEqual([])
        const first = writeResponse.success.at(0);
        expect(writeData).toStrictEqual(first)

        return clone(writeData)
      }

      const value1 = '1barfoo'
      const value2 = '2barfoo'

      await writeDoc(value1)
      await writeDoc(value2)

      // TODO: this query is not returning any documents with leveldb
      const preparedQuery = prepareQuery(
        storageInstance.schema,
        {
          selector: {
            _deleted: false
          },
          sort: [{ key: 'asc' }],
          skip: 0
        }
      )
    
      const allDocs = await storageInstance.query(preparedQuery)
      expect(allDocs.documents).toHaveLength(2)
  
      const first = allDocs.documents.at(0)
      expect(first).not.toBe(undefined)
      expect(first!.value).toBe(value1)

      await storageInstance.cleanup(Infinity)
    })

    // TODO: tests failing because the query isnt returning any documents with leveldb
    it.skip('should sort in the correct order', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<{ key: string, value: string }>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getTestDataSchema(),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const writeResponse = await storageInstance.bulkWrite([
        {
          document: getWriteData({ value: 'a' })
        },
        {
          document: getWriteData({ value: 'b' })
        },
        {
          document: getWriteData({ value: 'c' })
        }
      ], testContext)

      expect(writeResponse.error).toStrictEqual([])

      const preparedQuery = prepareQuery(
        storageInstance.schema,
        {
          selector: {},
          sort: [
            { value: 'desc' }
          ],
          skip: 0
        }
      )
      const allDocs = await storageInstance.query(preparedQuery)

      expect(allDocs.documents).toHaveLength(3)
      expect(allDocs!.documents[0]!.value).toBe('c')
      expect(allDocs!.documents[1]!.value).toBe('b')
      expect(allDocs!.documents[2]!.value).toBe('a')

      await storageInstance.cleanup(Infinity)
    })

    it('should have the same deterministic order of .query() and .getSortComparator()', async ({ expect }) => {
      const schema: RxJsonSchema<RxDocumentData<RandomDoc>> = fillWithDefaultSettings({
        version: 0,
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 100
          },
          equal: {
            type: 'string',
            maxLength: 20,
            enum: ['foobar']
          },
          increment: {
            type: 'number',
            minimum: 0,
            maximum: 1000,
            multipleOf: 1
          },
          random: {
            type: 'string',
            maxLength: 100
          }
        },
        indexes: [
          ['equal', 'id'],
          ['increment', 'id'],
          ['random', 'id'],
          [
            'equal',
            'increment',
            'id'
          ]
        ],
        required: [
          'id',
          'equal',
          'increment',
          'random'
        ]
      })

      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<RandomDoc>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema,
        options: {},
        multiInstance: true,
        devMode: false
      })

      const docsAmount = 6
      const docData: Array<RxDocumentWriteData<RandomDoc>> = new Array(docsAmount)
        .fill(0)
        .map((_x, idx) => ({
          id: randomString(10),
          equal: 'foobar',
          random: randomString(10),
          increment: idx + 1,
          _deleted: false,
          _attachments: {},
          _rev: EXAMPLE_REVISION_1,
          _meta: {
            lwt: now()
          }
        }))
      const writeResponse: RxStorageBulkWriteResponse<RandomDoc> = await storageInstance.bulkWrite(
        docData.map(d => ({ document: d })),
        testContext
      )
      if (Object.keys(writeResponse.error).length > 0) {
        throw new Error('could not save')
      }
      const docs = Object.values(writeResponse.success)

      async function testQuery(query: FilledMangoQuery<RandomDoc>): Promise<void> {
        const preparedQuery = prepareQuery(
          storageInstance!.schema,
          query
        )
        const docsViaQuery = (await storageInstance!.query(preparedQuery)).documents
        if (docsViaQuery.length !== docsAmount) {
          throw new Error('docs missing')
        }
        const sortComparator = getSortComparator(
          (storageInstance as any).schema,
          query
        )
        const docsViaSort = shuffleArray(docs).sort(sortComparator)
        expect(docsViaQuery).toStrictEqual(docsViaSort)
      }

      const queries: Array<FilledMangoQuery<RandomDoc>> = [
        {
          selector: {},
          sort: [
            { id: 'asc' }
          ],
          skip: 0
        },
        {
          selector: {},
          sort: [
            { equal: 'asc' },
            /**
             * RxDB will always append the primaryKey as last sort parameter
             * if the primary key is not used in the sorting before.
             */
            { id: 'asc' }
          ],
          skip: 0
        },
        {
          selector: {},
          sort: [
            { increment: 'desc' },
            { id: 'asc' }
          ],
          skip: 0
        },
        {
          selector: {},
          sort: [
            { equal: 'asc' },
            { increment: 'desc' },
            { id: 'asc' }
          ],
          skip: 0
        }
      ]
      for (const query of queries) {
        await testQuery(query)
      }

      await storageInstance.cleanup(Infinity)
    })

    it('should be able to search over a nested object', async ({ expect }) => {
      const schema = getNestedDocSchema()
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<NestedDoc>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema,
        options: {},
        multiInstance: true,
        devMode: false
      })
      const insertResult = await storageInstance.bulkWrite([
        {
          document: {
            id: 'foobar',
            nes: {
              ted: 'barfoo'
            },
            _deleted: false,
            _attachments: {},
            _rev: EXAMPLE_REVISION_1,
            _meta: {
              lwt: now()
            }
          }
        }
      ], testContext)

      expect(insertResult.error).toStrictEqual([])

      const preparedQuery = prepareQuery<NestedDoc>(
        schema,
        {
          selector: {
            'nes.ted': {
              $eq: 'barfoo'
            }
          },
          sort: [
            { 'nes.ted': 'asc' },
            { id: 'asc' }
          ],
          skip: 0
        }
      )

      const results = await storageInstance.query(preparedQuery)

      expect(results.documents.length).toBe(1)

      await storageInstance.cleanup(Infinity)      
    })
    it('querying many documents should work', async ({ expect }) => {
      const schema = getTestDataSchema()
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema,
        options: {},
        multiInstance: true,
        devMode: false
      })

      const amount = 100

      await storageInstance.bulkWrite(
        new Array(amount)
          .fill(0)
          .map((_v, idx) => ({
            document: getWriteData({
              key: idx.toString().padStart(5, '0') + '-' + randomString(10),
              value: idx + ''
            })
          })),
        testContext
      )

      const preparedQuery = prepareQuery<TestDocType>(
        schema,
        {
          selector: {},
          skip: 0,
          sort: [
            { key: 'asc' }
          ]
        }
      )
      const results = await storageInstance.query(preparedQuery)

      expect(results.documents.length).toBe(amount)

      await storageInstance.cleanup(Infinity)
    })
  })

  // TODO: tests failing as the query isnt returning any documents
  describe('.count()', () => {
    it('should count the correct amount', async ({ expect }) => {
      const schema = getTestDataSchema()
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema,
        options: {},
        multiInstance: true,
        devMode: false
      })

      const preparedQueryAll = prepareQuery<TestDocType>(
        storageInstance.schema,
        {
          selector: {},
          sort: [
            { key: 'asc' }
          ],
          skip: 0
        }
      )
      async function ensureCountIs(nr: number): Promise<void> {
        // TODO: this query is not returning any documents
        const result = await storageInstance.count(preparedQueryAll)
        expect(result.count).toBe(nr)
      }

      async function writeDoc () {
        const docData = getWriteData()
        const writeResponse = await storageInstance.bulkWrite([{ document: clone(docData) }], testContext)
        console.log(writeResponse)
      
        expect(writeResponse.error).toStrictEqual([])
        const first = writeResponse.success.at(0);
        expect(docData).toStrictEqual(first)
      }

      await ensureCountIs(0)
      await writeDoc()
      await ensureCountIs(1)
      await writeDoc()
      await ensureCountIs(2)

      await storageInstance.cleanup(Infinity)
    })
  })


  describe('.findDocumentsById()', () => {
    it('should find the documents', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getPseudoSchemaForVersion<TestDocType>(0, 'key'),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const pkey = randomCouchString(12)
      const docData = {
        key: pkey,
        value: 'barfoo',
        _deleted: false,
        _attachments: {},
        _rev: EXAMPLE_REVISION_1,
        _meta: {
          lwt: now()
        }
      }
      
      const writeResponse = await storageInstance.bulkWrite(
        [{
          document: clone(docData)
        }],
        testContext
      )

      expect(writeResponse.error).toStrictEqual([])
      const first = writeResponse.success.at(0);
      expect(docData).toStrictEqual(first)

      const found = await storageInstance.findDocumentsById([pkey], false)
      expect(found).toHaveLength(1)

      const foundDoc = found.at(0)
      expect(foundDoc).toStrictEqual(docData)

      await storageInstance.cleanup(Infinity)
    })

    /**
     * Some storage implementations ran into some limits
     * like SQLite SQLITE_MAX_VARIABLE_NUMBER etc.
     * Writing many documents must just work and the storage itself
     * has to workaround any problems with that.
     */
    it('should be able to insert and fetch many documents', async ({ expect }) => {
      const _storage = await testStorage.getStorage()
      const storageInstance = await _storage.createStorageInstance<TestDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema: getTestDataSchema(),
        options: {},
        multiInstance: true,
        devMode: false
      })

      const amount = 5000
      const writeRows = new Array(amount)
        .fill(0)
        .map(() => ({ document: getWriteData() }))

      // insert
      const writeResult = await storageInstance.bulkWrite(writeRows, 'insert-many-' + amount)
      expect(writeResult.error).toStrictEqual([])

      // fetch again
      const fetchResult = await storageInstance.findDocumentsById(writeRows.map(r => r.document.key), false)
      expect(Object.keys(fetchResult).length).toStrictEqual(amount)
    }, { timeout: 50000 })
  })

  describe('RxStorageInstance Queries', () => {
    testCorrectQueries<HumanDocumentType>(suite, testStorage, {
      testTitle: '$gt/$gte',
      data: [
        human('aa', 10, 'alice'),
        human('bb', 20, 'bob'),
        human('cc-looong-id', 30, 'carol'),
        human('dd', 40, 'dave'),
        human('ee', 50, 'eve')
      ],
      schema: withIndexes(schemas.human, [
        ['age'],
        ['age', 'firstName'],
        ['firstName'],
        ['passportId']
      ]),
      queries: [
        {
          info: 'normal $gt by number',
          query: {
            selector: {
              age: {
                $gt: 20
              }
            },
            sort: [{ age: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'cc-looong-id',
            'dd',
            'ee'
          ]
        },
        {
          info: 'normal $gte',
          query: {
            selector: {
              age: {
                $gte: 20
              }
            },
            sort: [{ age: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'bb',
            'cc-looong-id',
            'dd',
            'ee'
          ]
        },
        {
          info: '$gt on primary key',
          query: {
            selector: {
              passportId: {
                $gt: 'dd'
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'ee'
          ]
        },
        {
          info: '$gt and $gte on same field',
          query: {
            selector: {
              age: {
                $gte: 40,
                $gt: 19
              }
            },
            sort: [{ age: 'asc' }]
          },
          expectedResultDocIds: [
            'dd',
            'ee'
          ]
        },
        {
          info: 'sort by something that is not in the selector',
          query: {
            selector: {
              age: {
                $gt: 20
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'cc-looong-id',
            'dd',
            'ee'
          ]
        },
        {
          info: 'with string comparison',
          query: {
            selector: {
              firstName: {
                $gt: 'bob'
              }
            }
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'cc-looong-id',
            'dd',
            'ee'
          ]
        },
        {
          info: 'compare more then one field',
          query: {
            selector: {
              age: {
                $gt: 20
              },
              firstName: {
                $gt: 'a'
              }
            }
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'cc-looong-id',
            'dd',
            'ee'
          ]
        }
      ]
    })

    testCorrectQueries<schemas.HumanDocumentType>(suite, testStorage, {
      testTitle: '$lt/$lte',
      data: [
        human('dd', 40, 'dave'),
        human('ee', 50, 'eve')
      ],
      schema: withIndexes(schemas.human, [
        ['age'],
      ]),
      queries: [
        {
          info: 'normal $lt',
          query: {
            selector: {
              age: {
                $lt: 40
              }
            },
            sort: [{ age: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: []
        }
      ]
    })
  
    testCorrectQueries<schemas.HumanDocumentType>(suite, testStorage, {
      testTitle: '$lt/$lte',
      data: [
        human('aa', 10, 'alice'),
        human('bb', 20, 'bob'),
        human('cc-looong-id', 30, 'carol'),
        human('dd', 40, 'dave'),
        human('ee', 50, 'eve')
      ],
      schema: withIndexes(schemas.human, [
        ['age'],
        ['age', 'firstName'],
        ['firstName'],
        ['passportId']
      ]),
      queries: [
        {
          info: 'normal $lt',
          query: {
            selector: {
              age: {
                $lt: 40
              }
            },
            sort: [{ age: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'aa',
            'bb',
            'cc-looong-id'
          ]
        },
        {
          info: 'normal $lte',
          query: {
            selector: {
              age: {
                $lte: 40
              }
            },
            sort: [{ age: 'asc' }]
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: [
            'aa',
            'bb',
            'cc-looong-id',
            'dd'
          ]
        },
        {
          info: 'sort by something that is not in the selector',
          query: {
            selector: {
              age: {
                $lt: 40
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'aa',
            'bb',
            'cc-looong-id'
          ]
        },
        {
          info: '$lt on primaryKey',
          query: {
            selector: {
              passportId: {
                $lt: 'bb'
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: [
            'aa'
          ]
        },
        {
          info: 'compare more then one field',
          query: {
            selector: {
              age: {
                $lt: 40
              },
              firstName: {
                $lt: 'd'
              }
            }
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'aa',
            'bb',
            'cc-looong-id'
          ]
        }
      ]
    })

    testCorrectQueries<NestedHumanDocumentType>(suite, testStorage, {
      testTitle: 'nested properties',
      data: [
        nestedHuman({
          passportId: 'aaa',
          mainSkill: {
            level: 6,
            name: 'zzz'
          }
        }),
        nestedHuman({
          passportId: 'bbb',
          mainSkill: {
            level: 4,
            name: 'ttt'
          }
        }),
        nestedHuman({
          passportId: 'ccc',
          mainSkill: {
            level: 3,
            name: 'ccc'
          }
        })
      ],
      schema: withIndexes(schemas.nestedHuman, [
        ['mainSkill.level'],
        ['mainSkill.name']
      ]),
      queries: [
        {
          info: 'sort by nested mainSkill.name',
          query: {
            selector: {
            },
            sort: [{ 'mainSkill.name': 'asc' }]
          },
          expectedResultDocIds: [
            'ccc',
            'bbb',
            'aaa'
          ]
        }
      ]
    })
  
    testCorrectQueries<SimpleHumanV3DocumentType>(suite, testStorage, {
      testTitle: '$or',
      data: [
        simpleHumanV3({
          passportId: 'aaa',
          oneOptional: 'A'
        }),
        simpleHumanV3({
          passportId: 'bbb',
          oneOptional: 'B'
        }),
        simpleHumanV3({
          passportId: 'ccc'
        })
      ],
      schema: withIndexes(schemas.humanMinimal, [
      ]),
      queries: [
        {
          info: 'match A or B',
          query: {
            selector: {
              $or: [
                {
                  passportId: 'aaa'
                },
                {
                  passportId: 'bbb'
                }
              ]
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: [
            'aaa',
            'bbb'
          ]
        },
        {
          info: 'match with optional field',
          query: {
            selector: {
              passportId: {
                $eq: 'ccc'
              },
              $or: [
                {
                  oneOptional: {
                    $ne: 'foobar1'
                  }
                },
                {
                  oneOptional: {
                    $ne: 'foobar2'
                  }
                }
              ]
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: [
            'ccc'
          ]
        },
        {
          info: 'match non on non-existing optional field',
          query: {
            selector: {
              passportId: {
                $eq: 'foobar'
              },
              $or: [
                {
                  oneOptional: {
                    $ne: 'foobar1'
                  }
                },
                {
                  oneOptional: {
                    $ne: 'foobar2'
                  }
                }
              ]
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: []
        }
      ]
    })
  
    testCorrectQueries<schemas.HumanDocumentType>(suite, testStorage, {
      testTitle: '$in',
      data: [
        human('aa', 10, 'alice'),
        human('bb', 20, 'bob'),
        human('cc', 30, 'carol'),
        human('dd', 40, 'dave'),
        human('ee', 50, 'eve')
      ],
      schema: schemas.human,
      queries: [
        {
          info: 'get first',
          query: {
            selector: {
              firstName: {
                $in: ['alice']
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: [
            'aa'
          ]
        },
        {
          info: 'get by multiple',
          query: {
            selector: {
              firstName: {
                $in: ['alice', 'bob']
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: [
            'aa',
            'bb'
          ]
        },
        {
          info: 'get none matching',
          query: {
            selector: {
              firstName: {
                $in: ['foobar', 'barfoo']
              }
            },
            sort: [{ passportId: 'asc' }]
          },
          expectedResultDocIds: []
        },
        {
          info: 'get by primary key',
          query: {
            selector: {
              passportId: {
                $in: ['aa', 'cc', 'ee']
              }
            }
          },
          expectedResultDocIds: ['aa', 'cc', 'ee']
        }
      ]
    })
  
    testCorrectQueries<HeroArrayDocumentType>(suite, testStorage, {
      testTitle: '$elemMatch/$size',
      data: [
        {
          name: 'foo1',
          skills: [
            {
              name: 'bar1',
              damage: 10
            },
            {
              name: 'bar2',
              damage: 5
            }
          ]
        },
        {
          name: 'foo2',
          skills: [
            {
              name: 'bar3',
              damage: 10
            },
            {
              name: 'bar4',
              damage: 10
            }
          ]
        },
        {
          name: 'foo3',
          skills: [
            {
              name: 'bar5',
              damage: 5
            }
          ]
        }
      ],
      schema: schemas.heroArray,
      queries: [
        {
          info: '$elemMatch',
          query: {
            selector: {
              skills: {
                $elemMatch: {
                  damage: 5
                }
              }
            },
            sort: [{ name: 'asc' }]
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'foo1',
            'foo3'
          ]
        },
        {
          info: '$elemMatch with other operator',
          query: {
            selector: {
              name: {
                $eq: 'foo3'
              },
              skills: {
                $elemMatch: {
                  damage: 5
                }
              }
            },
            sort: [{ name: 'asc' }]
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'foo3'
          ]
        },
        {
          info: '$size',
          query: {
            selector: {
              skills: {
                $size: 1
              }
            },
            sort: [{ name: 'asc' }]
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: [
            'foo3'
          ]
        }
      ]
    })

    if (testStorage.hasBooleanIndexSupport) {
      testCorrectQueries(suite, testStorage, {
        testTitle: '$eq operator',
        data: [
          {
            id: 'zero',
            nonPrimaryString: 'zero',
            integer: 0,
            number: 0,
            boolean: false,
            null: 'not-null'
          },
          {
            id: 'one',
            nonPrimaryString: 'one',
            integer: 1,
            number: 1,
            boolean: true,
            null: null
          },
          {
            id: 'two',
            nonPrimaryString: 'two',
            integer: 2,
            number: 2,
            boolean: false,
            null: 'not-null'
          }
        ],
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: {
              type: 'string',
              maxLength: 100
            },
            nonPrimaryString: {
              type: 'string'
            },
            integer: {
              type: 'integer'
            },
            number: {
              type: 'number'
            },
            boolean: {
              type: 'boolean'
            },
            null: {
              type: 'null'
            }
          },
          indexes: [
            // boolean indexing was broken on some storages
            'boolean'
          ],
          required: [
            'id',
            'nonPrimaryString',
            'integer',
            'number',
            'boolean'
          ]
        },
        queries: [
          {
            info: '$eq primary key',
            query: {
              selector: {
                id: {
                  $eq: 'one'
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          },
          {
            info: '$eq non-primary string',
            query: {
              selector: {
                nonPrimaryString: {
                  $eq: 'one'
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          },
          {
            info: '$eq integer',
            query: {
              selector: {
                integer: {
                  $eq: 1
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          },
          {
            info: '$eq number',
            query: {
              selector: {
                number: {
                  $eq: 1
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          },
          {
            info: '$eq boolean',
            query: {
              selector: {
                boolean: {
                  $eq: true
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          },
          {
            info: '$eq null',
            query: {
              selector: {
                null: {
                  $eq: null
                }
              },
              sort: [{ id: 'asc' }]
            },
            expectedResultDocIds: [
              'one'
            ]
          }
        ]
      })
    }

    /**
     * @link https://github.com/pubkey/rxdb/issues/4571
     */
    testCorrectQueries(suite, testStorage, {
      testTitle: '$eq operator with composite primary key',
      data: [
        {
          id: 'one',
          key: 'one|1|1',
          string: 'one',
          number: 1,
          integer: 1
        },
        {
          id: 'two',
          key: 'two|1|1',
          string: 'two',
          number: 1,
          integer: 1
        },
        {
          id: 'three',
          key: 'one|2|1',
          string: 'one',
          number: 2,
          integer: 1
        }
      ],
      schema: {
        version: 0,
        indexes: ['string', ['number', 'integer']],
        primaryKey: {
          key: 'key',
          fields: ['string', 'number', 'integer'],
          separator: '|'
        },
        type: 'object',
        properties: {
          key: {
            maxLength: 100,
            type: 'string'
          },
          id: {
            maxLength: 100,
            type: 'string'
          },
          string: {
            maxLength: 50,
            type: 'string'
          },
          number: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            multipleOf: 1
          },
          integer: {
            type: 'integer',
            minimum: 0,
            maximum: 100,
            multipleOf: 1
          }
        },
        required: ['id', 'key', 'string', 'number', 'integer']
      },
      queries: [
        {
          info: '$eq primary key 2',
          query: {
            selector: {
              id: {
                $eq: 'one'
              }
            },
            sort: [{ id: 'asc' }]
          },
          expectedResultDocIds: ['one|1|1']
        },
        {
          info: '$eq by key',
          query: {
            selector: {
              key: {
                $eq: 'one|1|1'
              }
            },
            sort: [{ id: 'asc' }]
          },
          expectedResultDocIds: ['one|1|1']
        },
        {
          info: '$eq by composite key fields',
          query: {
            selector: {
              $and: [
                {
                  string: {
                    $eq: 'one'
                  }
                },
                {
                  number: {
                    $eq: 1
                  },
                  integer: {
                    $eq: 1
                  }
                }
              ]
            },
            sort: [{ number: 'desc', integer: 'desc' }]
          },
          expectedResultDocIds: ['one|1|1']
        }
      ]
    })
  
    /**
     * @link https://github.com/pubkey/rxdb/issues/5273
     */
    testCorrectQueries<{
      id: string
      hasHighlights: number
      lastOpenedAt: number
      exists: number
    }>(suite, testStorage, {
      testTitle: 'issue: compound index has wrong range',
      data: [
        {
          id: '1',
          exists: 1,
          hasHighlights: 1,
          lastOpenedAt: 1600000000000
        },
        {
          id: '2',
          exists: 1,
          hasHighlights: 1,
          lastOpenedAt: 1700000000000
        }
      ],
      schema: {
        version: 0,
        indexes: [
          ['exists', 'hasHighlights', 'lastOpenedAt']
        ],
        primaryKey: 'id',
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 1
          },
          hasHighlights: {
            type: 'integer',
            minimum: 0,
            maximum: 1,
            multipleOf: 1
          },
          lastOpenedAt: {
            type: 'integer',
            minimum: 0,
            maximum: Number.MAX_SAFE_INTEGER,
            multipleOf: 1
          },
          exists: {
            type: 'integer',
            minimum: 0,
            maximum: 1,
            multipleOf: 1
          }
        },
        required: ['id', 'hasHighlights', 'lastOpenedAt', 'exists']
      },
      queries: [
        {
          info: 'multiple operators',
          query: {
            selector: {
              exists: 1,
              lastOpenedAt: {
                $gte: 1600000000000,
                $lte: 1650000000000
              }
            }
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: ['1']
        },
        {
          info: 'multiple operators 2',
          query: {
            selector: {
              exists: 1,
              lastOpenedAt: {
                $gte: 1600000000000
              }
            }
          },
          selectorSatisfiedByIndex: false,
          expectedResultDocIds: ['1', '2']
        },
        {
          info: 'all operators in index',
          query: {
            selector: {
              exists: 1,
              hasHighlights: 1,
              lastOpenedAt: {
                $gte: 1600000000000
              }
            }
          },
          selectorSatisfiedByIndex: true,
          expectedResultDocIds: ['1', '2']
        }
      ]
    })

    testCorrectQueries(suite, testStorage, {
      testTitle: '$type',
      data: [
        {
          foo: '1',
          bar: 'test'
        },
        {
          foo: '2',
          bar: 2.0
        }
      ],
      schema: {
        version: 0,
        primaryKey: 'foo',
        type: 'object',
        properties: {
          foo: {
            type: 'string',
            maxLength: 100
          },
          bar: {
            oneOf: [
              {
                type: 'string'
              },
              {
                type: 'number'
              }
            ]
          }
        },
        required: ['foo', 'bar']
      },
      queries: [
        {
          info: '$type string',
          query: {
            selector: {
              bar: {
                $type: 'string'
              }
            },
            sort: [{ foo: 'asc' }]
          },
          expectedResultDocIds: [
            '1'
          ]
        },
        {
          info: '$type number',
          query: {
            selector: {
              bar: {
                $type: 'number'
              }
            },
            sort: [{ foo: 'asc' }]
          },
          expectedResultDocIds: [
            '2'
          ]
        }
      ]
    })
  
    testCorrectQueries<{
      _id: string
      name: string
      gender: string
      age: number
    }>(suite, testStorage, {
      testTitle: 'issue: wrong results on complex index',
      data: [
        {
          _id: 'nogljngyvo',
          name: 'cjbovwbzjx',
          gender: 'f',
          age: 18
        },
        {
          _id: 'zmbznyggnu',
          name: 'rpjljekeoy',
          gender: 'm',
          age: 3
        },
        {
          _id: 'hauezldqea',
          name: 'ckjndqrthh',
          gender: 'f',
          age: 20
        },
        {
          _id: 'utarwoqkav',
          name: 'thfubuvqwr',
          gender: 'm',
          age: 12
        }
      ],
      schema: {
        primaryKey: '_id',
        type: 'object',
        version: 0,
        properties: {
          _id: {
            type: 'string',
            maxLength: 20
          },
          name: {
            type: 'string',
            maxLength: 20
          },
          gender: {
            type: 'string',
            enum: ['f', 'm', 'x'],
            maxLength: 1
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 100,
            multipleOf: 1
          }
        },
        indexes: [
          [
            'name',
            'gender',
            'age',
            '_id'
          ],
          [
            'gender',
            'age',
            'name',
            '_id'
          ],
          [
            'age',
            'name',
            'gender',
            '_id'
          ]
        ]
      },
      queries: [
        {
          info: 'complex query on index',
          query: {
            selector: {
              gender: {
                $gt: 'x'
              },
              name: {
                $lt: 'hqybnsozrv'
              }
            },
            sort: [
              {
                gender: 'asc'
              },
              {
                age: 'asc'
              },
              {
                _id: 'asc'
              }
            ],
            index: [
              'name',
              'gender',
              'age',
              '_id'
            ]
          },
          expectedResultDocIds: []
        },
        {
          info: 'complex query on end of index',
          query: {
            selector: {
              gender: {
                $lt: 'x',
                $lte: 'm'
              }
            },
            sort: [
              {
                age: 'asc'
              },
              {
                name: 'asc'
              },
              {
                _id: 'asc'
              }

            ],
            index: [
              'gender',
              'age',
              'name',
              '_id'

            ]
          },
          expectedResultDocIds: ['zmbznyggnu', 'utarwoqkav', 'nogljngyvo', 'hauezldqea']
        },
        {
          info: 'had wrong index string on upper bound',
          query: {
            selector: {
              age: {
                $gte: 4,
                $lte: 20
              },
              gender: {
                $lt: 'm'
              }

            },
            sort: [
              {
                name: 'asc'
              },
              {
                _id: 'asc'
              }
            ],
            index: [
              'age',
              'name',
              'gender',
              '_id'
            ]
          },
          expectedResultDocIds: ['nogljngyvo', 'hauezldqea']
        },
        {
          info: 'had wrong index string on upper bound for $eq',
          query: {
            selector: {
              age: {
                $lte: 12
              },
              gender: {
                $lt: 'x',
                $eq: 'm'
              }
            },
            sort: [
              {
                _id: 'asc'
              }
            ],
            index: [
              'gender',
              'age',
              'name',
              '_id'
            ]
          },
          expectedResultDocIds: ['utarwoqkav', 'zmbznyggnu']
        }
      ]
    })
  })
}
