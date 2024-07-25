# @pluto-encrypted/inmemory

## Overview

`@pluto-encrypted/inmemory` is a package that provides a secure, encrypted in-memory storage solution for RxDB. By utilizing encryption for data stored in memory, this package ensures the integrity and confidentiality of transient data. It is ideal for applications where secure handling of data in memory is essential, without persisting it to disk.

This package integrates with `@pluto-encrypted/encryption`, offering an RxDB adapter that wraps in-memory storage with encryption features. This enables developers to implement secure in-memory storage solutions effortlessly within their RxDB-based applications.

## Installation

To install the `@pluto-encrypted/inmemory` package, use npm or yarn:

```bash
npm install @pluto-encrypted/inmemory
```

or

```bash
yarn add @pluto-encrypted/inmemory
```

## Usage

### Initialization

The `@pluto-encrypted/inmemory` package leverages `rxdb` and the `wrappedKeyEncryptionStorage` method from `@pluto-encrypted/encryption` to provide an encrypted in-memory storage adapter. Below is the main export for the package:

```javascript
import { wrappedKeyEncryptionStorage } from '@pluto-encrypted/encryption';
import { type RxStorage } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';

const storage: RxStorage<any, any> = wrappedKeyEncryptionStorage({
  storage: getRxStorageMemory()
});

export default storage;
```

### Using with Atala Prism Wallet SDK

Here is an example of how to integrate `@pluto-encrypted/inmemory` with the [Atala Prism Wallet SDK](https://github.com/hyperledger/identus-edge-agent-sdk-ts):

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk';
import InMemory from '@pluto-encrypted/inmemory';

const mediatorDIDString = 'your-mediator-did-string'; // Replace with your actual mediator DID string
const mediatorDID = Domain.DID.fromString(mediatorDIDString);
const store = new Store({
  name: 'my-app-db',
  storage: InMemory,
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
