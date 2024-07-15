import "./setup";

import { describe, it, beforeEach, afterEach } from 'vitest';
import { runTestSuite } from '@pluto-encrypted/test-suite';


import IndexDB from '../src'

const keyData = new Uint8Array(32);

describe("Testing suite", () => {
  runTestSuite({
    describe, it, beforeEach, afterEach
  }, {
    name: 'indexdb',
    getStorage() {
      return IndexDB
    },
    getPerformanceStorage() {
      return {
        storage: IndexDB,
        description: 'any'
      }
    },
    hasPersistence: true,
    hasMultiInstance: false,
    hasAttachments: false,
    hasBooleanIndexSupport: false,
    async hasEncryption() {
      return 'RandomPassword'
    }
  })
})
