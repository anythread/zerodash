import { InformationSignal } from '../../src'
import { beeUrl, getPostageBatchId, getRandomString } from '../utils'

const postageBatchId = getPostageBatchId()
const dappId = 'information-signal-test:v1'
const text = 'Kár érte, kiváló ügynök volt.' // for testing

type TestRecord = string

function isGraffitiFeedRecord(value: unknown): value is TestRecord {
  return value !== null && typeof value === 'string'
}

export function assertGraffitiFeedRecord(value: unknown): asserts value is TestRecord {
  if (!isGraffitiFeedRecord(value)) {
    throw new Error('Value is not a valid Graffiti Feed Record')
  }
}

function getSignalInstances(): {
  zero_: InformationSignal<TestRecord>
  zero_any: InformationSignal<TestRecord>
} {
  const consensus = {
    id: dappId,
    assertRecord: assertGraffitiFeedRecord,
  }

  const zero_ = new InformationSignal(beeUrl(), {
    consensus,
    postageBatchId,
  })

  const zero_any = new InformationSignal<TestRecord>(beeUrl(), {
    consensus: { id: consensus.id, assertRecord: () => true },
    postageBatchId,
  })

  return {
    zero_,
    zero_any,
  }
}

function getTestResourceId(sequenceId: number): string {
  return `${sequenceId}-${getRandomString()}`
}

describe('integration tests', () => {
  it('should write/read some data into the default GF', async () => {
    const { zero_ } = getSignalInstances()
    const resourceId = getTestResourceId(1)

    await zero_.write(text, { resourceId })

    const record = (await zero_.read({ resourceId }).next()).value.record

    expect(record).toStrictEqual(text)
  })
})
