import { keccak256Hash } from '../../src/utils'
import { Wallet } from 'ethers'
import { ZeroUnderscore } from '../../'
import { beeUrl, getPostageBatchId } from '../utils'
import { bytesToHex } from '../../src/utils'
import { Reference } from '@ethersphere/bee-js'
import { AnyThreadComment } from '../../src/types'

const postageBatchId = getPostageBatchId()
const personalStorageWallet = Wallet.createRandom()
const zero_ = new ZeroUnderscore(beeUrl(), {
  personalStorageSigner: personalStorageWallet.privateKey.slice(2),
})

const zero_any = new ZeroUnderscore(beeUrl(), {
  personalStorageSigner: personalStorageWallet.privateKey.slice(2),
  consensus: { id: 'AnyThread:v1', assertPersonalStorageRecord: () => true },
})

describe('integration tests', () => {
  it('should write/read some data into the default GF', async () => {
    const resourceId = 'test1'
    const contentHash = bytesToHex(keccak256Hash('smth')) as Reference
    const text = 'Csak a puffin ad neked erőt és mindent lebíró akaratot'
    const message = { contentHash, text, timestamp: Date.now() }

    await zero_.write(message, { resourceId, postageBatchId })

    const iaasIterator = (await zero_.read({ resourceId }).next()).value.iter
    const personalStorageRecord = (await iaasIterator.next()).value.record

    expect(personalStorageRecord).toStrictEqual(message)
  })

  it('should read on empty graffiti feed', async () => {
    const resourceId = 'test2'

    const iaasIterator = (await zero_.read({ resourceId }).next()).value
    expect(iaasIterator).toBeUndefined()
  })

  it('should write multiple personal storage records in graffiti feed', async () => {
    const resourceId = 'test4'
    const contentHash = bytesToHex(keccak256Hash('smth')) as Reference
    const text = 'Csak a puffin ad neked erőt és mindent lebíró akaratot'
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = { contentHash, text, timestamp: 2 }
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId, postageBatchId })
    await zero_.write(message2, { resourceId, postageBatchId })
    await zero_.write(message3, { resourceId, postageBatchId })

    const iaasIterator = (await zero_.read({ resourceId }).next()).value.iter
    const personalStorageRecord3 = (await iaasIterator.next()).value.record
    const personalStorageRecord2 = (await iaasIterator.next()).value.record
    const personalStorageRecord1 = (await iaasIterator.next()).value.record

    expect(personalStorageRecord1).toStrictEqual(message1)
    expect(personalStorageRecord2).toStrictEqual(message2)
    expect(personalStorageRecord3).toStrictEqual(message3)

    const noRecord = (await iaasIterator.next()).value
    expect(noRecord).toBeUndefined()
  })

  it('should insert a wrong record into PSR', async () => {
    const resourceId = 'test5'
    const contentHash = bytesToHex(keccak256Hash('smth')) as Reference
    const text = 'Csak a puffin ad neked erőt és mindent lebíró akaratot'
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = 'invalid data'
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId, postageBatchId })
    await zero_any.write(message2 as unknown as AnyThreadComment, { resourceId, postageBatchId })
    await zero_.write(message3, { resourceId, postageBatchId })

    const iaasIterator = (await zero_.read({ resourceId }).next()).value.iter
    const personalStorageRecord3 = (await iaasIterator.next()).value.record
    const personalStorageRecord2 = (await iaasIterator.next()).value.record
    const personalStorageRecord1 = (await iaasIterator.next()).value

    expect(personalStorageRecord3).toStrictEqual(message3)
    expect(personalStorageRecord2).toStrictEqual(message1)
    expect(personalStorageRecord1).toBeUndefined()
  })
})
