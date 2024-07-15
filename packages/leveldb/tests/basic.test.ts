import "./setup";

import fs from 'fs';
import { createRxDatabase } from 'rxdb'
import { describe, it } from 'vitest';

import { createLevelDBStorage } from '../src'

function clean () {
  if (fs.existsSync("./db1")) fs.rmdirSync("./db1", { recursive: true })
  if (fs.existsSync("./db2")) fs.rmdirSync("./db2", { recursive: true })
}

describe("Basic tests", () => {

  it('should be able to instanciate multiple databases in the same thread', async ({ expect }) => {
    clean()

    const collections = {
      todo: {
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 100 },
            name: { type: 'string' },
          },
          required: ['id', 'name']
        }
      }
    }

    const level1 = createLevelDBStorage({ dbPath: "./db1" })
    const db1 = await createRxDatabase({
      name: 'level-1-db',
      storage: level1,
      password: 'password-1'
    })
    await db1.addCollections(collections)
    await db1.todo.insert({ id: '1', name: 'milk' })
    const record1 = await db1.todo.findOne('1').exec()
    expect(record1._data.name).toBe('milk')

    const level2 = createLevelDBStorage({ dbPath: "./db2" })
    const db2 = await createRxDatabase({
      name: 'level-2-db',
      storage: level2,
      password: 'password-2'
    })
    await db2.addCollections(collections)
    await db2.todo.insert({ id: '2', name: 'potatoes' })
    const record2 = await db2.todo.findOne('2').exec()
    expect(record2._data.name).toBe('potatoes')

    clean()
  })
})
