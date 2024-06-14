/**
 * @packageDocumentation
 * @module leveldb
 * @description This is a RXDB LevelDB storage that supports encryption middleware.
 * In order to use this in your pluto-encrypted database you must write the following code:
 * Creating a LevelDB compatible storage is very simple.
 * ```typescript
 * import { createLevelDBStorage } from "@pluto-encrypted/leveldb";
 * import { Database } from "@pluto-encrypted/database";
 * //default password must be 32 bytes long
 * const defaultPassword = new Uint8Array(32).fill(1);
 * const database = db = await Database.createEncrypted({
 *          name: `my-db`,
 *          encryptionKey: defaultPassword,
 *          storage: createLevelDBStorage({
 *          dbName: "demo",
 *          dbPath: "/tmp/demo"
 *       })
 * });
 * ```
 */
import type {
  RxStorageInstance,
  RxStorageInstanceCreationParams,
} from 'rxdb'

import {
  newRxError,
  RXDB_VERSION
} from 'rxdb'

import type {
  LevelDBInternalConstructor,
  LevelDBSettings,
  LevelDBStorageInternals,
  RxStorageLevelDBType
} from './leveldb/types'

import {
  RxStorageIntanceLevelDB
} from './leveldb/instance'

import {
  LevelDBInternal
} from './leveldb/internal'

import {
  wrappedKeyEncryptionStorage
} from '@pluto-encrypted/encryption'

export type * from './leveldb/types'

export type { MangoQuerySelectorAndIndex, CRDTSchemaOptions, RxQueryPlanKey, PrimaryKey, StringKeys, TopLevelProperty, MangoQuerySortDirection } from 'rxdb/dist/types/types'
export type { RxJsonSchema, FilledMangoQuery, CompressionMode, RxQueryPlan, MangoQuery, MangoQueryNoLimit, MangoQuerySortPart } from 'rxdb'
export type { Level } from 'level'
export const RX_STORAGE_NAME_LEVELDB = 'leveldb'

async function preloadData<RxDocType>(constructorProps: LevelDBInternalConstructor<RxDocType>) {
  const internalStorage = new LevelDBInternal<RxDocType>(constructorProps)
  await internalStorage.getDocuments([])
  return internalStorage
}

const internalInstance = new Map<string, LevelDBInternal<any>>()

function getRxStorageLevel<RxDocType>(settings: LevelDBSettings): RxStorageLevelDBType<RxDocType> {
  const instance: RxStorageLevelDBType<any> = {
    name: RX_STORAGE_NAME_LEVELDB,
    rxdbVersion: RXDB_VERSION,
    async createStorageInstance<RxDocType>(params: RxStorageInstanceCreationParams<RxDocType, LevelDBSettings>): Promise<RxStorageInstance<RxDocType, LevelDBStorageInternals<RxDocType>, LevelDBSettings, any>> {
      if (params.schema.keyCompression) {
        throw newRxError('UT5', { args: { databaseName: params.databaseName, collectionName: params.collectionName } })
      }

      const levelDBConstructorProps: LevelDBInternalConstructor<RxDocType> = 'level' in settings
        ? {
          level: settings.level,
          refCount: 1,
          schema: params.schema
        }
        : {
          dbPath: settings.dbPath,
          refCount: 1,
          schema: params.schema
        }

      const databasePath = 'level' in levelDBConstructorProps
        ? levelDBConstructorProps.level.location
        : levelDBConstructorProps.dbPath

      const existingInstance = internalInstance.get(databasePath)

      if (!existingInstance) {
        internalInstance.set(databasePath, await preloadData<RxDocType>(levelDBConstructorProps))
      } else {
        existingInstance.refCount++
        internalInstance.set(databasePath, existingInstance)
      }

      const rxStorageInstance = new RxStorageIntanceLevelDB<RxDocType>(
        this,
        params.databaseName,
        params.collectionName,
        params.schema,
        internalInstance.get(databasePath)!,
        settings
      )

      return rxStorageInstance
    }
  }

  return instance
}

export function createLevelDBStorage(settings: LevelDBSettings) {
  return wrappedKeyEncryptionStorage({
    storage: getRxStorageLevel(settings)
  })
}
