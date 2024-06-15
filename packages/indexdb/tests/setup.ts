import "fake-indexeddb/auto";
import { TextEncoder, TextDecoder } from "util";

import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";
import nodeCrypto from "crypto";

if (process.env.NODE_ENV === "debug") {
  addRxPlugin(RxDBDevModePlugin);
}

Object.defineProperty(globalThis, "crypto", {
  value: {
    getRandomValues: (arr) => nodeCrypto.getRandomValues(arr),
    subtle: nodeCrypto.subtle
  },
});

Object.assign(global, { TextDecoder, TextEncoder });
