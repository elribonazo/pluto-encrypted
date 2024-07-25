# @pluto-encrypted/indexdb

## Overview

`@pluto-encrypted/indexdb` is a package that provides secure, encrypted interactions with the IndexedDB database. By leveraging encryption for data at rest and during transactions, this package ensures data integrity and confidentiality, making it ideal for applications that demand enhanced data security.

This package includes `@pluto-encrypted/encryption`, which serves as an RxDB wrapper over IndexedDB. This integration allows developers to easily incorporate encrypted storage solutions within their RxDB-based applications, providing seamless and robust data protection.

## Installation

To install the `@pluto-encrypted/indexdb` package, use npm or yarn:

```bash
npm install @pluto-encrypted/indexdb
```

or

```bash
yarn add @pluto-encrypted/indexdb
```

## Usage

### Initialization

The `@pluto-encrypted/indexdb` package leverages `rxdb` and the `wrappedKeyEncryptionStorage` method from `@pluto-encrypted/encryption` to provide a secure storage solution. Below is the main export for the package:

```javascript
import { wrappedKeyEncryptionStorage } from '@pluto-encrypted/encryption';
import { type RxStorage } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

const storage: RxStorage<any, any> = wrappedKeyEncryptionStorage({
  storage: getRxStorageDexie()
});

export default storage;
```

### Using with Atala Prism Wallet SDK

Here is a practical example of how to integrate `@pluto-encrypted/indexdb` with the [Atala Prism Wallet SDK](https://github.com/hyperledger/identus-edge-agent-sdk-ts):

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk'
import IndexDB from '@pluto-encrypted/indexdb'

const mediatorDIDString = 'your-mediator-did-string'; // Replace with your actual mediator DID string
const mediatorDID = Domain.DID.fromString(mediatorDIDString);
const store = new Store({
  name: 'my-app-db',
  storage: IndexDB,
  password: 'something secure 1235!' // Use a secure password
});
const apollo = new Apollo();
const pluto = new Pluto(store, apollo);

const agent = Agent.initialize({ mediatorDID, pluto, apollo });
```

## Contributing

We welcome contributions! Please read our [Contributing Guide](https://github.com/atala-community-projects/pluto-encrypted/blob/master/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache License, Version 2.0. See [LICENCE](./LICENSE) file for the full terms and conditions.

## Support

If you have any questions or need help, feel free to open an issue on our [GitHub repository](https://github.com/atala-community-projects/pluto-encrypted/issues).

---

## QA & Documentation

| Statements                  | Branches                | Functions                 | Lines             |
| --------------------------- | ----------------------- | ------------------------- | ----------------- |
| ![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=flat) | ![Branches](https://img.shields.io/badge/branches-100%25-brightgreen.svg?style=flat) | ![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=flat) | ![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=flat) |
