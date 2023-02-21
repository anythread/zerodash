import { Utils } from '@ethersphere/bee-js'
import { HexString } from '@ethersphere/bee-js/dist/types/utils/hex'
import { randomBytes } from 'crypto'
import { InformationSignal } from '../../src'
import { AnyThreadComment } from '../../src/types'
import { assertAnyThreadComment } from '../../src/utils'
import { beeUrl, getPostageBatchId, getTestResourceId } from '../utils'

const postageBatchId = getPostageBatchId()
const dappId = 'information-signal-test:v1'
const text = 'Kár érte, kiváló ügynök volt.' // for testing
const timestamp = 1676990501732
const contentHash = Utils.bytesToHex(randomBytes(32)) as HexString<64>

function getSignalInstances(): {
  zero_: InformationSignal<AnyThreadComment>
  zero_any: InformationSignal<AnyThreadComment>
} {
  const consensus = {
    id: dappId,
    assertRecord: assertAnyThreadComment,
  }

  const zero_ = new InformationSignal(beeUrl(), {
    consensus,
    postageBatchId,
  })

  const zero_any = new InformationSignal<AnyThreadComment>(beeUrl(), {
    consensus: { id: consensus.id, assertRecord: () => true },
    postageBatchId,
  })

  return {
    zero_,
    zero_any,
  }
}

describe('integration tests', () => {
  it('should write/read some data into the default GF', async () => {
    const zero_ = new InformationSignal(beeUrl(), { postageBatchId })
    const resourceId = getTestResourceId(1)
    const message = 'Te menj előre a te hangod mélyebb'

    await zero_.write(message, { resourceId })

    const record = (await zero_.read({ resourceId }).next()).value.record

    expect(record).toStrictEqual(message)
  })

  it('should read on empty graffiti feed', async () => {
    const { zero_ } = getSignalInstances()
    const resourceId = getTestResourceId(2)

    const iaasIterator = (await zero_.read({ resourceId }).next()).value
    expect(iaasIterator).toBeUndefined()
  })

  it('should write multiple records in graffiti feed', async () => {
    const { zero_ } = getSignalInstances()
    const resourceId = getTestResourceId(3)
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = { contentHash, text, timestamp: 2 }
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId })
    await zero_.write(message2, { resourceId })
    await zero_.write(message3, { resourceId })

    const graffitiIterator = zero_.read({ resourceId })
    const personalStorageRecord3 = (await graffitiIterator.next()).value.record
    const personalStorageRecord2 = (await graffitiIterator.next()).value.record
    const personalStorageRecord1 = (await graffitiIterator.next()).value.record

    expect(personalStorageRecord1).toStrictEqual(message1)
    expect(personalStorageRecord2).toStrictEqual(message2)
    expect(personalStorageRecord3).toStrictEqual(message3)

    const noRecord = (await graffitiIterator.next()).value
    expect(noRecord).toBeUndefined()
  })

  it('should skip a wrong record in Graffiti Feed', async () => {
    const { zero_, zero_any } = getSignalInstances()
    const resourceId = getTestResourceId(4)
    const message1 = { contentHash, text, timestamp: 1 }
    const message2 = 420
    const message3 = { contentHash, text, timestamp: 3 }

    await zero_.write(message1, { resourceId })
    await zero_any.write(message2 as unknown as AnyThreadComment, { resourceId })
    await zero_.write(message3, { resourceId })

    const graffitiIterator = zero_.read({ resourceId })
    const personalStorageRecord3 = (await graffitiIterator.next()).value.record
    const personalStorageRecord2 = (await graffitiIterator.next()).value.record
    const personalStorageRecord1 = (await graffitiIterator.next()).value

    expect(personalStorageRecord3).toStrictEqual(message3)
    expect(personalStorageRecord2).toStrictEqual(message1)
    expect(personalStorageRecord1).toBeUndefined()
  })
})
