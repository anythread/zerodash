import { Bee, Reference } from '@ethersphere/bee-js'
import { keccak256Hash, numberToFeedIndex } from './utils'
import { getConsensualPrivateKey, getGraffitiWallet, serializeGraffitiRecord } from './graffiti-feed'
import { AnyThreadComment, BeeJsSigner, Bytes, EthAddress, GraffitiFeedRecord, Signer } from './types'
import {
  assertAnyThreadComment,
  assertGraffitiFeedRecord,
  feedIndexToNumber,
  getAddressOfSigner,
} from './utils'

export const DEFAULT_RESOURCE_ID = 'any'
const DEFAULT_POSTAGE_BATCH_ID = '0000000000000000000000000000000000000000000000000000000000000000'
const DEFAULT_CONSENSUS_ID = 'AnyThread:v1'

interface BaseConstructorOptions<T = AnyThreadComment> {
  /**
   * The first update will be fetched first
   * Default: false
   */
  fifo?: boolean
  consensus?: {
    /**
     * The used consensus identifier of the GraffitiFeed
     * Default: AnyThread:v1
     */
    id: string
    /**
     * Assertion function that throws an error if the parameter
     * does not satisfy the structural requirements.
     * record formats:
     * - PersonalStorageSignal: record in the personal storage.
     * - InformationSignal: record in the graffiti feed.
     * Default: assertAnyThreadComment
     * @param unknown any object for asserting
     */
    assertRecord: (unknown: unknown) => asserts unknown is T
  }
  /**
   * Swarm Postage Batch ID which is only required when write happens
   * Default: 000000000000000000000000000000000000000000000
   */
  postageBatchId?: string
  /**
   * API Url of the Ethereum Swarm Bee client
   * Default: http://localhost:1633
   */
  beeApiUrl?: string
}

interface ConstructorOptions<T = AnyThreadComment> extends BaseConstructorOptions<T> {
  /**
   * User signer of the Personal Storage
   * Omitting it does not allow writing
   */
  personalStorageSigner?: Signer
}

interface ReadOptions {
  /**
   * Resource identifier such as BMT hash of content or any string
   * Default: 'any'
   */
  resourceId: string
}

interface ReadPersonalStorageReturn<T> {
  index: number
  record: T
}

interface InformationSignalRead<T> {
  index: number
  record: T
}

interface PersonalStorageSignalRead<T> {
  iaasIdentifier: EthAddress
  index: number
  iter: AsyncGenerator<ReadPersonalStorageReturn<T>>
}

type WriteOptions = ReadOptions

export class PersonalStorageSignal<UserPayload = AnyThreadComment> {
  public fifo: boolean
  public postageBatchId: string
  private bee: Bee
  private personalStorageSigner: Signer
  /** Graffiti Feed Topic */
  private consensusHash: Bytes<32>
  private assertPersonalStorageRecord: (unknown: unknown) => asserts unknown is UserPayload

  constructor(beeApiUrl: string, options?: ConstructorOptions<UserPayload>) {
    this.postageBatchId = options?.postageBatchId ?? DEFAULT_POSTAGE_BATCH_ID
    this.consensusHash = keccak256Hash(options?.consensus?.id ?? DEFAULT_CONSENSUS_ID)
    this.fifo = options?.fifo ?? false
    this.bee = new Bee(beeApiUrl)
    this.personalStorageSigner =
      options?.personalStorageSigner ??
      ({
        sign: () => {
          throw new Error('No Signer has been passed.')
        },
      } as unknown as BeeJsSigner)
    this.assertPersonalStorageRecord = options?.consensus?.assertRecord ?? assertAnyThreadComment
  }

  async *read(options?: ReadOptions): AsyncGenerator<PersonalStorageSignalRead<UserPayload>> {
    const resourceId = options?.resourceId ?? DEFAULT_RESOURCE_ID
    const graffitiSigner = getConsensualPrivateKey(resourceId)
    const graffitiWallet = getGraffitiWallet(graffitiSigner)
    const graffitiReader = this.bee.makeFeedReader('sequence', this.consensusHash, graffitiWallet.address)
    const personalStorageTopic = keccak256Hash(graffitiSigner, this.consensusHash)
    const checkedIaasIdentifiers: Record<EthAddress, boolean> = {}

    if (this.fifo) {
      // start from the beginning and do it until there is no more
      let i = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const index = i
          const record = await graffitiReader.download({ index: numberToFeedIndex(i++) })
          try {
            const { iaasIdentifier } = await this.readGraffitiFeedRecord(record.reference)

            // if the `iaasIdentifier` was already once in the stream then it neglects that.
            if (checkedIaasIdentifiers[iaasIdentifier]) {
              continue
            }
            checkedIaasIdentifiers[iaasIdentifier] = true

            yield {
              iaasIdentifier,
              iter: this.readPersonalStorage(iaasIdentifier, personalStorageTopic),
              index,
            }
          } catch (e) {
            // if the structure of the graffiti feed is wrong it just steps further
            continue
          }
        } catch (e) {
          break
        }
      }
    } else {
      // last record
      try {
        const lastRecord = await graffitiReader.download()
        const lastIndex = feedIndexToNumber(lastRecord.feedIndex)
        for (let i = lastIndex; i >= 0; i--) {
          try {
            const record = await graffitiReader.download({ index: numberToFeedIndex(i) })
            const { iaasIdentifier } = await this.readGraffitiFeedRecord(record.reference)

            // if the `iaasIdentifier` was already once in the stream then it neglects that.
            if (checkedIaasIdentifiers[iaasIdentifier]) {
              continue
            }
            checkedIaasIdentifiers[iaasIdentifier] = true

            yield {
              iaasIdentifier,
              iter: this.readPersonalStorage(iaasIdentifier, personalStorageTopic),
              index: i,
            }
          } catch (e) {
            continue
          }
        }
      } catch (e) {
        return
      }
    }
  }

  // This part could be removed and put its content to the single owner chunk body
  private async readGraffitiFeedRecord(contentAddr: Reference): Promise<GraffitiFeedRecord> {
    const data = await this.bee.downloadData(contentAddr)
    try {
      const json = JSON.parse(new TextDecoder().decode(data))
      assertGraffitiFeedRecord(json)

      return json
    } catch (e) {
      throw new Error(`Could not decode Graffiti Feed Record: ${(e as Error).message}`)
    }
  }

  // This part could be removed and put its content to the single owner chunk body
  private async readPersonalStorageRecord(contentAddr: Reference): Promise<UserPayload> {
    const data = await this.bee.downloadData(contentAddr)
    try {
      const json = JSON.parse(new TextDecoder().decode(data))
      this.assertPersonalStorageRecord(json)

      return json
    } catch (e) {
      throw new Error(`Could not decode Graffiti Feed Record: ${(e as Error).message}`)
    }
  }

  private async *readPersonalStorage(
    iaasIdentifier: EthAddress,
    topic: Bytes<32>,
  ): AsyncGenerator<ReadPersonalStorageReturn<UserPayload>> {
    const feedReader = this.bee.makeFeedReader('sequence', topic, iaasIdentifier)

    if (this.fifo) {
      // start from the beginning and do it until there is no more
      let i = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const index = i
          const record = await feedReader.download({ index: numberToFeedIndex(i++) })

          try {
            yield {
              index,
              record: await this.readPersonalStorageRecord(record.reference),
            }
          } catch (e) {
            continue
          }
        } catch (e) {
          break
        }
      }
    } else {
      // last record
      try {
        const lastRecord = await feedReader.download()
        const lastIndex = feedIndexToNumber(lastRecord.feedIndex)
        for (let i = lastIndex; i >= 0; i--) {
          try {
            const record = await feedReader.download({ index: numberToFeedIndex(i) })

            yield {
              index: i,
              record: await this.readPersonalStorageRecord(record.reference),
            }
          } catch (e) {
            continue
          }
        }
      } catch (e) {
        return
      }
    }
  }

  async write(data: UserPayload, options?: WriteOptions) {
    this.assertPersonalStorageRecord(data)
    const resourceId = options?.resourceId ?? DEFAULT_RESOURCE_ID
    const graffitiSigner = getConsensualPrivateKey(resourceId)
    const graffitiWriter = this.bee.makeFeedWriter('sequence', this.consensusHash, graffitiSigner)
    const personalStorageTopic = keccak256Hash(graffitiSigner, this.consensusHash)
    const personalStorageWriter = this.bee.makeFeedWriter(
      'sequence',
      personalStorageTopic,
      this.personalStorageSigner,
    )
    const graffitiRecord: GraffitiFeedRecord = {
      iaasIdentifier: getAddressOfSigner(this.personalStorageSigner),
    }

    // write graffiti feed
    const { reference: gfrReference } = await this.bee.uploadData(
      this.postageBatchId,
      serializeGraffitiRecord(graffitiRecord),
    )
    await graffitiWriter.upload(this.postageBatchId, gfrReference)

    // write personal storage
    const { reference: psReference } = await this.bee.uploadData(
      this.postageBatchId,
      this.serializeUserPayload(data),
    )
    await personalStorageWriter.upload(this.postageBatchId, psReference)
  }

  private serializeUserPayload(userPayload: UserPayload): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(userPayload))
  }
}

export class InformationSignal<UserPayload = AnyThreadComment> {
  public fifo: boolean
  public postageBatchId: string
  private bee: Bee
  /** Graffiti Feed Topic */
  private consensusHash: Bytes<32>
  private assertGraffitiRecord: (unknown: unknown) => asserts unknown is UserPayload

  constructor(beeApiUrl: string, options?: ConstructorOptions<UserPayload>) {
    this.postageBatchId = options?.postageBatchId ?? DEFAULT_POSTAGE_BATCH_ID
    this.consensusHash = keccak256Hash(options?.consensus?.id ?? DEFAULT_CONSENSUS_ID)
    this.fifo = options?.fifo ?? false
    this.bee = new Bee(beeApiUrl)
    this.assertGraffitiRecord = options?.consensus?.assertRecord ?? assertGraffitiFeedRecord
  }

  async *read(options?: ReadOptions): AsyncGenerator<InformationSignalRead<UserPayload>> {
    const resourceId = options?.resourceId ?? DEFAULT_RESOURCE_ID
    const graffitiSigner = getConsensualPrivateKey(resourceId)
    const graffitiWallet = getGraffitiWallet(graffitiSigner)
    const graffitiReader = this.bee.makeFeedReader('sequence', this.consensusHash, graffitiWallet.address)

    if (this.fifo) {
      // start from the beginning and do it until there is no more
      let i = 0
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          const index = i
          const recordPointer = await graffitiReader.download({ index: numberToFeedIndex(i++) })
          try {
            const record = await this.readGraffitiFeedRecord(recordPointer.reference)

            yield {
              record,
              index,
            }
          } catch (e) {
            // if the structure of the graffiti feed is wrong it just steps further
            continue
          }
        } catch (e) {
          break
        }
      }
    } else {
      // last record
      try {
        const lastRecord = await graffitiReader.download()
        const lastIndex = feedIndexToNumber(lastRecord.feedIndex)
        for (let i = lastIndex; i >= 0; i--) {
          try {
            const recordPointer = await graffitiReader.download({ index: numberToFeedIndex(i) })
            const record = await this.readGraffitiFeedRecord(recordPointer.reference)

            yield {
              record,
              index: i,
            }
          } catch (e) {
            continue
          }
        }
      } catch (e) {
        return
      }
    }
  }

  async write(data: UserPayload, options?: WriteOptions) {
    this.assertGraffitiRecord(data)
    const resourceId = options?.resourceId ?? DEFAULT_RESOURCE_ID
    const graffitiSigner = getConsensualPrivateKey(resourceId)
    const graffitiWriter = this.bee.makeFeedWriter('sequence', this.consensusHash, graffitiSigner)

    // write graffiti feed
    const { reference: gfrReference } = await this.bee.uploadData(
      this.postageBatchId,
      serializeGraffitiRecord(data),
    )
    await graffitiWriter.upload(this.postageBatchId, gfrReference)
  }

  // This part could be removed and put its content to the single owner chunk body
  private async readGraffitiFeedRecord(contentAddr: Reference): Promise<UserPayload> {
    const data = await this.bee.downloadData(contentAddr)
    try {
      const json = JSON.parse(new TextDecoder().decode(data))
      this.assertGraffitiRecord(json)

      return json
    } catch (e) {
      throw new Error(`Could not decode Graffiti Feed Record: ${(e as Error).message}`)
    }
  }
}
