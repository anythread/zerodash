import { keccak256Hash } from '../../src/utils'
import { Wallet } from 'ethers'
import { PersonalStorageSignal } from '../../src'
import { beeUrl, getPostageBatchId, getRandomString } from '../utils'
import { bytesToHex } from '../../src/utils'
import { Reference } from '@ethersphere/bee-js'
import { AnyThreadComment } from '../../src/types'

const postageBatchId = getPostageBatchId()
const text = 'Csak a puffin ad neked erőt és mindent lebíró akaratot' // for testing
const contentHash = bytesToHex(keccak256Hash('smth')) as Reference

function getPersonalStorageWallet(): {
  personalStorageWallet: Wallet
  zero_: PersonalStorageSignal
  zero_any: PersonalStorageSignal
} {
  const personalStorageWallet = Wallet.createRandom()
  const zero_ = new PersonalStorageSignal(beeUrl(), {
    personalStorageSigner: personalStorageWallet.privateKey.slice(2),
    postageBatchId,
  })

  const zero_any = new PersonalStorageSignal(beeUrl(), {
    personalStorageSigner: personalStorageWallet.privateKey.slice(2),
    consensus: { id: 'AnyThread:v1', assertRecord: () => true },
    postageBatchId,
  })

  return {
    personalStorageWallet,
    zero_,
    zero_any,
  }
}

function getTestResourceId(sequenceId: number): string {
  return `${sequenceId}-${getRandomString()}`
}

describe('integration tests', () => {
  it('should write/read some data into the default GF', async () => {
    const { zero_ } = getPersonalStorageWallet()
    const resourceId = getTestResourceId(1)
    const message = { contentHash, text, timestamp: Date.now() }

    await zero_.write(message, { resourceId })

    const iaasIterator = (await zero_.read({ resourceId }).next()).value.iter
    const personalStorageRecord = (await iaasIterator.next()).value.record

    expect(personalStorageRecord).toStrictEqual(message)
  })

  it('should read on empty graffiti feed', async () => {
    const { zero_ } = getPersonalStorageWallet()
    const resourceId = getTestResourceId(2)

    const iaasIterator = (await zero_.read({ resourceId }).next()).value
    expect(iaasIterator).toBeUndefined()
  })

  it('should write multiple personal storage records in graffiti feed', async () => {
    const { zero_ } = getPersonalStorageWallet()
    const resourceId = getTestResourceId(3)
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = { contentHash, text, timestamp: 2 }
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId })
    await zero_.write(message2, { resourceId })
    await zero_.write(message3, { resourceId })

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
    const { zero_, zero_any } = getPersonalStorageWallet()
    const resourceId = getTestResourceId(4)
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = 'invalid data'
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId })
    await zero_any.write(message2 as unknown as AnyThreadComment, { resourceId })
    await zero_.write(message3, { resourceId })

    const iaasIterator = (await zero_.read({ resourceId }).next()).value.iter
    const personalStorageRecord3 = (await iaasIterator.next()).value.record
    const personalStorageRecord2 = (await iaasIterator.next()).value.record
    const personalStorageRecord1 = (await iaasIterator.next()).value

    expect(personalStorageRecord3).toStrictEqual(message3)
    expect(personalStorageRecord2).toStrictEqual(message1)
    expect(personalStorageRecord1).toBeUndefined()
  })

  it('should return IAAS identifier only once', async () => {
    const { personalStorageWallet: wallet1, zero_: zero_1 } = getPersonalStorageWallet()
    const { personalStorageWallet: wallet2, zero_: zero_2 } = getPersonalStorageWallet()
    const resourceId = getTestResourceId(5)

    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = { contentHash, text, timestamp: 2 }
    const message3 = { contentHash, text, timestamp: 3 }
    await zero_1.write(message1, { resourceId })
    await zero_2.write(message2, { resourceId })
    await zero_1.write(message3, { resourceId })

    // the latest will be the first in the loop which is the first iaas
    const iaasIterator = zero_1.read({ resourceId })
    const iaas1 = (await iaasIterator.next()).value
    const iaas2 = (await iaasIterator.next()).value
    const iaasNonExistent = (await iaasIterator.next()).value

    expect(iaas1.iaasIdentifier).toBe(wallet1.address)
    expect(iaas2.iaasIdentifier).toBe(wallet2.address)
    expect(iaasNonExistent).toBeUndefined()
    expect((await iaas1.iter.next()).value.record).toStrictEqual(message3)
    expect((await iaas1.iter.next()).value.record).toStrictEqual(message1)
    expect((await iaas2.iter.next()).value.record).toStrictEqual(message2)
  })
})
