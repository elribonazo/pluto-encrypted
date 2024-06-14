import "fake-indexeddb/auto";
import { addRxPlugin } from "rxdb";
import { RxDBDevModePlugin } from "rxdb/plugins/dev-mode";

if (process.env.NODE_ENV === "debug") {
  addRxPlugin(RxDBDevModePlugin);
}


