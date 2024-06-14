/**
 * @packageDocumentation
 * @module indexdb
 * @description This is a RXDB IndexDB storage that supports encryption middleware.
 * In order to use this in your pluto-encrypted database you must write the following code:
 * Creating a IndexDB compatible storage is very simple.
 * 
 * ```typescript
 * import IndexDB from "@pluto-encrypted/indexdb";
 * import { Database } from "@pluto-encrypted/database";
 * //default password must be 32 bytes long
 * const defaultPassword = new Uint8Array(32).fill(1);
 * const database = db = await Database.createEncrypted({
 *          name: `my-db`,
 *          encryptionKey: defaultPassword,
 *          storage: IndexDB,
 * });
 * ```
 *
 */
import { wrappedKeyEncryptionStorage } from '@pluto-encrypted/encryption';
import { type RxStorage } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

const storage: RxStorage<any, any> = wrappedKeyEncryptionStorage({
  storage: getRxStorageDexie()
})

export default storage
