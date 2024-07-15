# Pluto Encrypted

Is a community maintained project which aims to bring a scalable and future proof storage solution for Wallet SDK on typescript. By using this package you can ensure that this dependency will fit the AtalaPrism wallet SDK contract and provide the SDK with storage finally.

We currently support database wrappers for IndexDB, InMemory, LevelDB.
We are not going to stop here but ensure that our SDK can be used in any platform and language.

## Documentation & Contribution Guidelines

The pluto encrypted documentation is always available on all branches [HERE](https://github.com/elribonazo/pluto-encrypted/blob/master/docs/README.md) but we have also deployed an online version of documentation.

Go to documentation portal [here](https://atala-community-projects.github.io/pluto-encrypted)

Pull requests are WELCOME!! please check the [Contribution guidelines](https://github.com/elribonazo/pluto-encrypted/blob/master/CONTRIBUTION-GUIDELINES.md) first


## How to use

We currently provide 3 database storages - InMemory, IndexDB, and LevelDB.
These modules are designed to be used with [`@atala/prism-wallet-sdk`](https://github.com/input-output-hk/atala-prism-wallet-sdk-ts)

```bash
npm i @atala/prism-wallet-sdk @pluto-encrypted/inmemory
# or npm i @pluto-encrypted/indexdb --save
# or npm i @pluto-encrypted/leveldb --save
```

### InMemory

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk'
import InMemory from '@pluto-encrypted/inmemory'

const mediatorDID = Domain.DID.fromString(mediatorDIDString)
const store = new Store({
  name: 'my-app-db',
  storage: InMemory,
  password: 'something secure 1235!'
})
const apollo = new Apollo()
const pluto = new Pluto(store, apollo)

const agent = Agent.initialize({ mediatorDID, pluto, apollo })
```

### IndexDB

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk'
import IndexDB from '@pluto-encrypted/indexdb'

const mediatorDID = Domain.DID.fromString(mediatorDIDString)
const store = new Store({
  name: 'my-app-db',
  storage: IndexDB,
  password: 'something secure 1235!'
})
const apollo = new Apollo()
const pluto = new Pluto(store, apollo)

const agent = Agent.initialize({ mediatorDID, pluto, apollo })
```

### LevelDB

```typescript
import { Agent, Domain, Store, Apollo, Pluto } from '@atala/prism-wallet-sdk'
import { createLevelDBStorage } from '@pluto-encrypted/leveldb'

const mediatorDID = Domain.DID.fromString(mediatorDIDString)
const store = new Store({
  name: 'my-app-db',
  storage: createLevelDBStorage({
    dbPath: '/tmp/my-app/db'
  }),
  password: 'something secure 1235!'
})
const apollo = new Apollo()
const pluto = new Pluto(store, apollo)

const agent = Agent.initialize({ mediatorDID, pluto, apollo })
```

## Development

### Tests

```bash
npm install
npm run build
npm run test
```
