# Pluto Encrypted

> **WARNING:** @elribonazo: I'm no longer going to be maintaining pluto-encrypted in favor of [RIDB](https://github.com/trust0-project/RIDB)
> RXDB is a robust project so this project can still be used for Identus and other database projects.
> What this means is that from now on, I'll prioritise RIDB development over this.
> Thanks for support

Is a community maintained project which aims to bring a scalable and future proof storage solution for Wallet SDK on typescript. By using this package you can ensure that this dependency will fit the AtalaPrism wallet SDK contract and provide the SDK with storage finally.

## Interface
Edge SDK Pluto interface [v4.0.0](https://input-output-hk.github.io/atala-prism-wallet-sdk-ts/interfaces/Domain.Pluto.html)
```typescript

export interface Pluto {

    storeCredentialMetadata(metadata: Anoncreds.CredentialRequestMeta, linkSecret: Anoncreds.LinkSecret): Promise<void>;

    fetchCredentialMetadata(linkSecretName: string): Promise<Anoncreds.CredentialRequestMeta | null>;

    start(): Promise<void>;

    storePrismDID(did: DID, keyPathIndex: number, privateKey: PrivateKey, privateKeyMetaId: string | null, alias?: string): Promise<void>;

    storePeerDID(did: DID, privateKeys: Array<PrivateKey>): Promise<void>;

    storeDIDPair(host: DID, receiver: DID, name: string): Promise<void>;

    storeMessage(message: Message): Promise<void>;

    storeMessages(messages: Array<Message>): Promise<void>;

    storePrivateKeys(privateKey: PrivateKey, did: DID, keyPathIndex: number, metaId: string | null): Promise<void>;

    storeMediator(mediator: DID, host: DID, routing: DID): Promise<void>;

    storeCredential(credential: Credential): Promise<void>;

    getAllPrismDIDs(): Promise<PrismDIDInfo[]>;

    getDIDInfoByDID(did: DID): Promise<PrismDIDInfo | null>;
 
    getDIDInfoByAlias(alias: string): Promise<PrismDIDInfo[]>;

    getPrismDIDKeyPathIndex(did: DID): Promise<number | null>;

    getPrismLastKeyPathIndex(): Promise<number>;

    getAllPeerDIDs(): Promise<Array<PeerDID>>;

    getDIDPrivateKeysByDID(did: DID): Promise<Array<PrivateKey>>;

    getDIDPrivateKeyByID(id: string): Promise<PrivateKey | null>;

    getAllDidPairs(): Promise<Array<DIDPair>>;

    getPairByDID(did: DID): Promise<DIDPair | null>;

    getPairByName(name: string): Promise<DIDPair | null>;

    getAllMessages(): Promise<Array<Message>>;

    getAllMessagesByDID(did: DID): Promise<Array<Message>>;

    getAllMessagesSent(): Promise<Array<Message>>;

    getAllMessagesReceived(): Promise<Array<Message>>;

    getAllMessagesSentTo(did: DID): Promise<Array<Message>>;

    getAllMessagesReceivedFrom(did: DID): Promise<Array<Message>>;

    getAllMessagesOfType(type: string, relatedWithDID?: DID): Promise<Array<Message>>;

    getAllMessagesByFromToDID(from: DID, to: DID): Promise<Array<Message>>;

    getMessage(id: string): Promise<Message | null>;

    getAllMediators(): Promise<Array<Mediator>>;

    getAllCredentials(): Promise<Array<Credential>>;

    getLinkSecret(linkSecretName?: string): Promise<Anoncreds.LinkSecret | null>;

    storeLinkSecret(linkSecret: Anoncreds.LinkSecret, linkSecretName: string): Promise<void>;
}
```

We currently support database wrappers for IndexDB, InMemory, LevelDB.
We are not going to stop here but ensure that our SDK can be used in any platform and language.

### Documentation & Contribution Guidelines
The pluto encrypted documentation is always available on all branches [HERE](https://github.com/elribonazo/pluto-encrypted/blob/master/docs/README.md) but we have also deployed an online version of documentation.

Go to documentation portal [here](https://atala-community-projects.github.io/pluto-encrypted)

Pull requests are WELCOME!! please check the [Contribution guidelines](https://github.com/elribonazo/pluto-encrypted/blob/master/CONTRIBUTION-GUIDELINES.md) first


### How to use

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
