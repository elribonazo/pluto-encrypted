import "./setup";

import { describe, it, beforeEach, afterEach } from 'vitest';
import { runTestSuite } from '@pluto-encrypted/test-suite';
import { createLevelDBStorage } from '../src'

const SegfaultHandler = require('segfault-handler');
SegfaultHandler.registerHandler('crash.log');

describe("Testing suite", () => {
  describe("Level with dbPath", () => {
    runTestSuite({
      describe, it, beforeEach, afterEach
    }, {
      name: 'leveldb',
      getStorage(i = '') {
        return createLevelDBStorage({ dbPath: './db' + i })
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
