/**
 * @packageDocumentation
 * @module inmemory
 * @description This is a RXDB InMemory storage that supports encryption middleware.
 * In order to use this in your pluto-encrypted database you must write the following code:
 * Creating a InMemory compatible storage is very simple.
 *
 * 
 * ```typescript
 * import InMemory from "@pluto-encrypted/inmemory";
 * import { Database } from "@pluto-encrypted/database";
 * //default password must be 32 bytes long
 * const defaultPassword = new Uint8Array(32).fill(1);
 * const database = db = await Database.createEncrypted({
 *          name: `my-db`,
 *          encryptionKey: defaultPassword,
 *          storage: InMemory,
 * });
 * ```
 *
 */

import { wrappedKeyEncryptionStorage } from '@pluto-encrypted/encryption'

import {
  getRxStorageMemory
} from 'rxdb/plugins/storage-memory'


/**
 * InMemory storage
 * @description Use this as storage in our RXDB database. For now there is no initialisation settings, so you can use it out of the box.
 */
const storage = wrappedKeyEncryptionStorage({
  storage: getRxStorageMemory()
})

export default storage


