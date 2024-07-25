# @pluto-encrypted/leveldb

## Overview

`@pluto-encrypted/leveldb` provides a secure, encrypted storage solution for RxDB using LevelDB. By integrating encryption middleware, this package ensures data security and confidentiality while leveraging LevelDB's persistence features. It is ideal for applications that require robust and secure storage capabilities.

This package uses `@pluto-encrypted/encryption` to wrap LevelDB with encryption, allowing for seamless integration with RxDB-based applications.

## Installation

To install the `@pluto-encrypted/leveldb` package, use npm or yarn:

```bash
npm install @pluto-encrypted/leveldb
```

or

```bash
yarn add @pluto-encrypted/leveldb
```

## Usage

### Initialization

To use `@pluto-encrypted/leveldb` with RxDB, you need to create an encrypted LevelDB storage instance. Below is an example of how to set it up:

```typescript
import { createLevelDBStorage } from '@pluto-encrypted/leveldb';
import { Database } from '@pluto-encrypted/database';

// Ensure the default password is 32 bytes long
const defaultPassword = new Uint8Array(32).fill(1);

const database = await Database.createEncrypted({
  name: 'my-db',
  encryptionKey: defaultPassword,
  storage: createLevelDBStorage({
    dbName: 'demo',
    dbPath: '/tmp/demo' // Adjust the path as needed
  })
});
```

### Using with Atala Prism Wallet SDK

Here’s how to integrate `@pluto-encrypted/leveldb` with the [Atala Prism Wallet SDK](https://github.com/hyperledger/identus-edge-agent-sdk-ts):

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk';
import { createLevelDBStorage } from '@pluto-encrypted/leveldb';

const mediatorDIDString = 'your-mediator-did-string'; // Replace with your actual mediator DID string
const mediatorDID = Domain.DID.fromString(mediatorDIDString);

const store = new Store({
  name: 'my-app-db',
  storage: createLevelDBStorage({
    dbName: 'my-app-db',
    dbPath: '/path/to/db'
  }),
  password: 'something secure 1235!' // Use a secure password
});
const apollo = new Apollo();
const pluto = new Pluto(store, apollo);

const agent = Agent.initialize({ mediatorDID, pluto, apollo });
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](https://github.com/atala-community-projects/pluto-encrypted/blob/master/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full terms and conditions.

## Support

If you have any questions or need help, feel free to open an issue on our [GitHub repository](https://github.com/atala-community-projects/pluto-encrypted/issues).

---

## QA & Documentation
| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=flat) |

---
