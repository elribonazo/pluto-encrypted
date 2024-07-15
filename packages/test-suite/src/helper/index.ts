import assert from 'assert';
import {
  clone,
  randomString
} from 'async-test-util'
import type {
  MangoQuery,
  RxDocumentData,
  RxJsonSchema,
  RxStorage,
} from 'rxdb'
import {
  createRxDatabase,
  deepFreeze,
  ensureNotFalsy,
  fillWithDefaultSettings,
  getPrimaryFieldOfPrimaryKey,
  getQueryMatcher,
  getQueryPlan,
  // NOTE: this is making a weird queryPlan
  getSortComparator,
  lastOfArray,
  newRxError,
  normalizeMangoQuery,
  now,
  randomCouchString
} from 'rxdb'
import type {
  describe,
  it,
  beforeEach,
  afterEach
} from 'vitest'

export interface RandomDoc {
  id: string
  equal: string
  random: string
  increment: number
}
export interface TestSuite {
  describe: typeof describe
  it: typeof it
  beforeEach: typeof beforeEach
  afterEach: typeof afterEach
}
export interface NestedDoc {
  id: string
  nes: {
    ted: string
  }
}
export interface TestDocType { key: string, value: string }
export interface OptionalValueTestDoc { key: string, value?: string }
/**
 * Some storages had problems with umlauts and other special chars.
 * So we add these to all test strings.
 * TODO add emojis
 */
export const TEST_DATA_CHARSET = '0987654321ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzäöüÖÄßÜ[]{}\''
export const TEST_DATA_CHARSET_LAST_SORTED = ensureNotFalsy(lastOfArray(TEST_DATA_CHARSET.split('').sort()))
// const someEmojis = '😊💩👵🍌';
export function randomStringWithSpecialChars(length: number) {
  return randomString(length, TEST_DATA_CHARSET)
}

/**
 * @returns a format of the query that can be used with the storage
 * when calling RxStorageInstance().query()
 */
export function prepareQuery<RxDocType>(schema, mutateableQuery) {
  if (!mutateableQuery.sort) {
    throw newRxError('SNH', {
      query: mutateableQuery
    })
  }

  /**
     * Store the query plan together with the
     * prepared query to save performance.
     */
  console.log('prepareQueryPlan', schema, mutateableQuery)
  // NOTE: schema.indexes
  // => [ [ '_deleted', 'key' ], [ '_meta.lwt', 'key' ] ]
  // QUESTION: these indexes lead directly to the query...
  // which then fails find anything with the _meta.lwt,key index ....
  // which means we get no results
  // ...
  // WHY is there this misalignment between setIndex and using indexes
  // to look results up?

  const queryPlan = getQueryPlan<RxDocType>(schema, mutateableQuery)
  return {
    query: mutateableQuery,
    queryPlan
  }
}

export function getNestedDocSchema() {
  const schema: RxJsonSchema<RxDocumentData<NestedDoc>> = fillWithDefaultSettings({
    version: 0,
    primaryKey: 'id',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        maxLength: 100
      },
      nes: {
        type: 'object',
        properties: {
          ted: {
            type: 'string',
            maxLength: 100
          }
        },
        required: [
          'ted'
        ]
      }
    },
    indexes: [
      ['nes.ted', 'id']
    ],
    required: [
      'id',
      'nes'
    ]
  })
  return schema
}

export function getWriteData(
  ownParams: Partial<RxDocumentData<TestDocType>> = {}
): RxDocumentData<TestDocType> {
  return Object.assign(
    {
      key: randomString(10),
      value: 'barfoo',
      _deleted: false,
      _attachments: {},
      _meta: {
        lwt: now()
      },
      _rev: EXAMPLE_REVISION_1
    },
    ownParams
  )
}

export function getTestDataSchema(): RxJsonSchema<RxDocumentData<TestDocType>> {
  return fillWithDefaultSettings({
    version: 0,
    type: 'object',
    primaryKey: 'key',
    properties: {
      key: {
        type: 'string',
        maxLength: 100
      },
      value: {
        type: 'string',
        maxLength: 100
      }
    },
    required: [
      'key',
      'value'
    ],
    indexes: [
      'value'
    ]
  })
}

export const EXAMPLE_REVISION_1 = '1-12080c42d471e3d2625e49dcca3b8e1a'
export const EXAMPLE_REVISION_2 = '2-22080c42d471e3d2625e49dcca3b8e2b'
export const EXAMPLE_REVISION_3 = '3-32080c42d471e3d2625e49dcca3b8e3c'
export const EXAMPLE_REVISION_4 = '4-42080c42d471e3d2625e49dcca3b8e3c'
export const testContext = 'rx-storage-implementations.test.ts'
export const testQueryContext = 'rx-storage-query-correctness.test.ts'

export interface RxTestStorage {
  // TODO remove name here, it can be read out already via getStorage().name
  readonly name: string
  readonly getStorage: (encrypted?: boolean) => RxStorage<any, any>
  /**
     * Returns a storage that is used in performance tests.
     * For example in a browser it should return the storage with an IndexedDB based adapter,
     * while in node.js it must use the filesystem.
     */
  readonly getPerformanceStorage: (encrypted?: boolean) => {
    storage: RxStorage<any, any>
    /**
         * A description that describes the storage and setting.
         * For example 'dexie-native'.
         */
    description: string
  }
  /**
     * True if the storage is able to
     * keep data after an instance is closed and opened again.
     */
  readonly hasPersistence: boolean
  readonly hasMultiInstance: boolean
  readonly hasAttachments: boolean
  readonly hasBooleanIndexSupport: boolean
  /**
     * To make it possible to test alternative encryption plugins,
     * you can specify hasEncryption to signal
     * the test runner that the given storage already contains an
     * encryption plugin that should be used to test encryption tests.
     * Otherwise the encryption-crypto-js plugin will be tested.
     *
     * hasEncryption must contain a function that is able
     * to create a new password.
     */
  readonly hasEncryption?: () => Promise<string>
}

export interface TestCorrectQueriesInput<RxDocType> {
  notRunIfTrue?: () => boolean
  testTitle: string
  schema: RxJsonSchema<RxDocType>
  data: RxDocType[]
  queries: Array<{
    info: string
    query: MangoQuery<RxDocType>
    expectedResultDocIds: string[]
    /**
         * If this is set, we expect the output
         * of the RxDB query planner to have
         * set selectorSatisfiedByIndex as the given value.
         */
    selectorSatisfiedByIndex?: boolean
  } | undefined>
}

export function withIndexes<RxDocType>(
  schema: RxJsonSchema<RxDocType>,
  indexes: string[][]
): RxJsonSchema<RxDocType> {
  schema = clone(schema)
  schema.indexes = indexes
  return schema
}

export function testCorrectQueries<RxDocType>(
  suite: TestSuite,
  testStorage: RxTestStorage,
  input: TestCorrectQueriesInput<RxDocType>
) {
  const { it, describe } = suite
  // let storage: RxStorage<any, any>
  // let storageInstance: RxStorageInstance<RxDocType, any, any, any> | undefined

  describe(`Testing - ${input.testTitle}`, () => {
    if (input.notRunIfTrue && input.notRunIfTrue()) {
      return
    }

    it(input.testTitle, async () => {
      const schema = fillWithDefaultSettings(clone(input.schema));
      const primaryPath = getPrimaryFieldOfPrimaryKey(schema.primaryKey);
      const storage = await testStorage.getStorage()
      const storageInstance = await storage.createStorageInstance<RxDocType>({
        databaseInstanceToken: randomCouchString(10),
        databaseName: randomCouchString(12),
        collectionName: randomCouchString(12),
        schema,
        options: {},
        multiInstance: false,
        devMode: false
      });

      const rawDocsData = input.data.map(row => {
        const writeData = Object.assign(
          {},
          row,
          {
            _deleted: false,
            _attachments: {},
            _meta: {
              lwt: now()
            },
            _rev: EXAMPLE_REVISION_1
          }
        );
        return writeData;
      });
      await storageInstance.bulkWrite(
        rawDocsData.map(document => ({ document })),
        testQueryContext
      );

      const database = await createRxDatabase({
        name: randomCouchString(10),
        storage,
        eventReduce: true,
        ignoreDuplicate: true,
        allowSlowCount: true
      })

      const collections = await database.addCollections({
        test: {
          schema: input.schema
        }
      })
      const collection = collections.test
      await collection.bulkInsert(input.data)



      for (const queryData of input.queries) {
        if (!queryData) {
          continue;
        }

        const queryForStorage = clone(queryData.query) as MangoQuery<RxDocType>;
        if (!queryForStorage.selector) {
          queryForStorage.selector = {};
        }
        (queryForStorage.selector as any)._deleted = false;
        if (queryForStorage.index) {
          (queryForStorage.index as any).unshift('_deleted');
        }
        const normalizedQuery = deepFreeze(normalizeMangoQuery(schema, queryForStorage));
        const skip = normalizedQuery.skip ? normalizedQuery.skip : 0;
        const limit = normalizedQuery.limit ? normalizedQuery.limit : Infinity;
        const skipPlusLimit = skip + limit;

        const preparedQuery = prepareQuery<RxDocType>(
          schema,
          normalizedQuery
        );

        // Test output of RxStorageStatics
        const queryMatcher = getQueryMatcher(schema, normalizedQuery);
        const sortComparator = getSortComparator(schema, normalizedQuery);
        const staticsResult = rawDocsData.slice(0)
          .filter(d => queryMatcher(d))
          .sort(sortComparator)
          .slice(skip, skipPlusLimit);
        const resultStaticsIds = staticsResult.map(d => (d as any)[primaryPath]);
        try {
          assert.deepStrictEqual(resultStaticsIds, queryData.expectedResultDocIds);
        } catch (err) {
          console.log('WRONG QUERY RESULTS FROM STATICS: ' + queryData.info);
          console.dir({
            queryData,
            resultStaticsIds
          });

          throw err;
        }


        // Test correct selectorSatisfiedByIndex
        if (typeof queryData.selectorSatisfiedByIndex !== 'undefined') {
          const queryPlan = getQueryPlan(schema, normalizedQuery);
          try {
            assert.strictEqual(
              queryPlan.selectorSatisfiedByIndex,
              queryData.selectorSatisfiedByIndex
            );
          } catch (err) {
            console.log('WRONG selectorSatisfiedByIndex IN QUERY PLAN: ' + queryData.info);
            console.dir(queryData);
            console.dir(queryPlan);
            throw err;
          }
        }

        // Test output of RxStorageInstance.query();
        // TODO: queries arent returning anything
        const resultFromStorage = await storageInstance.query(preparedQuery);
        const resultIds = resultFromStorage.documents.map(d => (d as any)[primaryPath]);
        try {
          assert.deepStrictEqual(resultIds, queryData.expectedResultDocIds);
        } catch (err) {
          console.log('WRONG QUERY RESULTS FROM RxStorageInstance.query(): ' + queryData.info);
          console.dir({
            resultIds,
            queryData,
            preparedQuery
          });
          throw err;
        }

        // Test output of RxCollection.find()
        const rxQuery = collection.find(queryData.query);
        const resultFromCollection = await rxQuery.exec();
        const resultFromCollectionIds = resultFromCollection.map(d => d.primary);
        try {
          assert.deepStrictEqual(resultFromCollectionIds, queryData.expectedResultDocIds);
        } catch (err) {
          console.log('WRONG QUERY RESULTS FROM RxCollection.find(): ' + queryData.info);
          console.dir(queryData);
          throw err;
        }
        const byId = await collection.findByIds(resultFromCollectionIds).exec();
        resultFromCollectionIds.forEach(id => assert.ok(byId.has(id), 'findById must have same output'));


        // Test output of .count()
        if (
          !queryData.query.limit &&
          !queryData.query.skip
        ) {
          const countResult = await storageInstance.count(preparedQuery);
          try {
            assert.strictEqual(
              countResult.count,
              queryData.expectedResultDocIds.length
            );
          } catch (err) {
            console.log('WRONG QUERY RESULTS FROM .count(): ' + queryData.info);
            console.dir(queryData);
            throw err;
          }
        }
      }
      await Promise.all([
        database.remove(),
        storageInstance.cleanup(Infinity),
        storageInstance.close()
      ]);
    })
  })
}
