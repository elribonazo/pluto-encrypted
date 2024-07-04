import "fake-indexeddb/auto";
import { TextEncoder, TextDecoder } from "util";

import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import nodeCrypto from "crypto";

// set up segfault handler
const SegfaultHandler = require('segfault-handler');
 
SegfaultHandler.registerHandler("crash.log"); // With no argument, SegfaultHandler will generate a generic log file name
 
if (process.env.NODE_ENV === "debug") {
  addRxPlugin(RxDBDevModePlugin);
}

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (arr) => nodeCrypto.getRandomValues(arr),
    subtle: nodeCrypto.subtle
  },
});

const _TextUtils = JSON.parse(JSON.stringify({ TextDecoder, TextEncoder }))
Object.assign(global, _TextUtils)
