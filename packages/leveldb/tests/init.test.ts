import "./setup";

import { describe, it, beforeEach, afterEach } from 'vitest';
import { runTestSuite } from '@pluto-encrypted/test-suite';
import { createLevelDBStorage } from '../src'

describe("Testing suite", () => {
  describe("Level with dbPath", () => {
    runTestSuite({
      describe, it, beforeEach, afterEach
    }, {
      name: 'leveldb',
      getStorage() {
        return createLevelDBStorage({ dbPath: './db' })
      },
      getPerformanceStorage() {
        return {
          storage: createLevelDBStorage({ dbPath: './db' }),
          description: 'any'
        }
      },
      hasPersistence: true,
      hasMultiInstance: false,
      hasAttachments: false,
      hasBooleanIndexSupport: true,
      async hasEncryption() {
        return 'RandomPassword'
      }
    })
  })
})
