# Zero Dash

This library facilitates to use [Graffiti Feeds](https://github.com/fairDataSociety/FIPs/blob/master/text/0062-graffiti-feed.md) on [Ethereum Swarm](https://www.ethswarm.org/).

![graffiti-feed-chart](https://github.com/fairDataSociety/FIPs/raw/master/resources/graffiti-feed.png)

# Install

```sh
npm install zerodash --save
```

# Usage

The library provides `InformationSignal` and `PersonalStorageSignal` classes that read/write GraffitiFeed according to the consensus and other configuration parameters.

The consensus consists of an arbitrary `id` and an assert function that validates records either in graffiti feed or in the personal storage, respectively.
```ts
const id = 'SampleDapp:v1'

export interface SampleDappRecord {
  /** text of the message */
  text: string
  /** creation time of the comment */
  timestamp: number
}

export function assertRecord(value: unknown): asserts value is SampleDappRecord {
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).includes('text') &&
    Object.keys(value).includes('timestamp')
  ) {
    throw new Error('The given value is not a valid personal storage record')
  }
}
```

With that, the rules have been created for a specific Graffit Feed.

The only architectural decision remaining is whether the information is backed up by the personal storage of the user or not.
Both are supported by the library, but the Personal Storage Signal interface is recommended to use in favor of the proper aggregation.

## Personal Storage Signal

For write operations, the `personalStorageSigner` and the `postageBatchId` must be set.

```ts
import { PersonalStorageSignal } from 'zerodash'
import { Wallet } from 'ethers'

const personalStorageWallet = Wallet.createRandom()
const beeUrl = 'http://localhost:1633' // Bee API URL to connect p2p storage network
const postageBatchId = '0000000000000000000000000000000000000000000000000000000000000000' // 64 chars length Bee Postage Batch Id
const resourceId = 'demo' // any string/content hash that represents the resource to which the Personal Storage record will be associated. 

const personalStorageSignal = new PersonalStorageSignal(beeUrl, {
  personalStorageSigner: personalStorageWallet.privateKey.slice(2),
  postageBatchId,
  consensus: {
    id,
    assertRecord,
  },
})

// write message to personal storage and advertise personal storage area in graffiti feed
await personalStorageSignal.write({ text: 'Hello World!', timestamp: 1675202470222 }, { resourceId })
```

The read operation gives back an async generator on the consensual graffiti feed that fetches all advertised Personal Storage identifiers
and prepares their Personal Storage readers.

```ts
// ...
// read the graffiti feed and all personal storage records
for await (const personalStorage of personalStorageSignal.read({ resourceId: 'puffin' })) {
  console.log('Personal Storage address in the Graffiti Feed', personalStorage.iaasIdentifier)
  console.log('Personal Storage position in the Graffiti Feed', personalStorage.index)
  for await (const personalStorageRecord of personalStorage.iter) {
    console.log(/content hash
      'Personal Storage record in the Graffiti Feed',
      personalStorageRecord.index,
      personalStorageRecord.record,
    )
  }
}
```

Another examples can be found in the [integration tests](test/integration/personal-storage-signal.spec.ts)

## Information Signal

For write operations, the `postageBatchId` must be set.

```ts
import { InformationSignal } from 'zerodash'

const beeUrl = 'http://localhost:1633' // Bee API URL to connect p2p storage network
const postageBatchId = '0000000000000000000000000000000000000000000000000000000000000000' // 64 chars length Bee Postage Batch Id
const resourceId = 'demo' // any string/content hash that represents the resource to which the Personal Storage record will be associated. 

const informationSignal = new InformationSignal(beeUrl, {
  postageBatchId,
  consensus: {
    id,
    assertRecord,
  },
})

// write message to personal storage and advertise personal storage area in graffiti feed
await informationSignal.write({ text: 'Hello there!', timestamp: 1676840715471 }, { resourceId })
```

The read operation gives back an async generator on the consensual graffiti feed that fetches all advertised infromation about the resourceId.

```ts
// ...
// read the graffiti feed and all personal storage records
for await (const personalStorage of informationSignal.read({ resourceId: 'puffin' })) {
  console.log('Record in the Graffiti Feed', personalStorage.index)
  console.log('Record position in the Graffiti Feed', personalStorage.index)
}
```

Another examples can be found in the [integration tests](test/integration/information-signal.spec.ts)

# Compilation

In order to compile code run

```sh
npm run compile
```

You can find the resulted code under the `dist` folder.

For types compilation, run

```sh
npm run compile:types
```

# Testing

The testing needs running Bee client node for integration testing.
You must set `BEE_POSTAGE` environment variable with a valid Postage batch.

To run test execute

```sh
npm run test
```
