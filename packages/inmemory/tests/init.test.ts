import "./setup";

import { describe, it, beforeEach, afterEach } from 'vitest';
import { runTestSuite } from '@pluto-encrypted/test-suite';


import InMemory from '../src'

const keyData = new Uint8Array(32);

describe("Testing suite", () => {
  runTestSuite({
    describe, it, beforeEach, afterEach
  }, {
    name: 'inmemory',
    getStorage() {
      return InMemory
    },
    getPerformanceStorage() {
      return {
        storage: InMemory,
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
