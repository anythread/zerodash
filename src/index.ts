import { Bee, Reference } from '@ethersphere/bee-js'
import { keccak256Hash, numberToFeedIndex } from './utils'
import { getConsensualPrivateKey, getGraffitiWallet, serializeGraffitiRecord } from './graffiti-feed'
import { AnyThreadComment, BeeJsSigner, EthAddress, GraffitiFeedRecord, Signer } from './types'
import {
  assertAnyThreadComment,
  assertGraffitiFeedRecord,
  feedIndexToNumber,
  getAddressOfSigner,
} from './utils'

export interface Bytes<Length extends number> extends Uint8Array {
  readonly length: Length
}

export const DEFAULT_RESOURCE_ID = 'any'
const DEFAULT_POSTAGE_BATCH_ID = '0000000000000000000000000000000000000000000000000000000000000000'
const DEFAULT_CONSENSUS_ID = 'AnyThread:v1'

interface ConstructorOptions<T = AnyThreadComment> {
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
     * - record from user personal storage - does not satisfy
     * the structural requirements.
     * Default: assertAnyThreadComment
     * @param unknown any object for asserting
     */
    assertPersonalStorageRecord: (unknown: unknown) => asserts unknown is T
  }
  /**
   * User signer of the Personal Storage
   * Omitting it does not allow writing
   */
  personalStorageSigner?: Signer
  /**
   * API Url of the Ethereum Swarm Bee client
   * Default: http://localhost:1633
   */
  beeApiUrl?: string
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

interface ReadReturn<T> {
  iaasIdentifier: EthAddress
  index: number
  iter: AsyncGenerator<ReadPersonalStorageReturn<T>>
}

interface WriteOptions extends ReadOptions {
  postageBatchId?: string
}

export class ZeroUnderscore<UserPayload = AnyThreadComment> {
  public fifo: boolean
  private bee: Bee
  private personalStorageSigner: Signer
  /** Graffiti Feed Topic */
  private consensusHash: Bytes<32>
  private assertPersonalStorageRecord: (unknown: unknown) => asserts unknown is UserPayload

  constructor(beeApiUrl: string, options?: ConstructorOptions<UserPayload>) {
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
    this.assertPersonalStorageRecord =
      options?.consensus?.assertPersonalStorageRecord ?? assertAnyThreadComment
  }

  async *read(options?: ReadOptions): AsyncGenerator<ReadReturn<UserPayload>> {
    const resourceId = options?.resourceId ?? DEFAULT_RESOURCE_ID
    const graffitiSigner = getConsensualPrivateKey(resourceId)
    const graffitiWallet = getGraffitiWallet(graffitiSigner)
    const graffitiReader = this.bee.makeFeedReader('sequence', this.consensusHash, graffitiWallet.address)
    const personalStorageTopic = keccak256Hash(graffitiSigner, this.consensusHash)

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
    let postageBatchId = DEFAULT_POSTAGE_BATCH_ID
    if (options?.postageBatchId) {
      postageBatchId = options.postageBatchId
    }
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
      postageBatchId,
      serializeGraffitiRecord(graffitiRecord),
    )
    await graffitiWriter.upload(postageBatchId, gfrReference)

    // write personal storage
    const { reference: psReference } = await this.bee.uploadData(
      postageBatchId,
      this.serializeUserPayload(data),
    )
    await personalStorageWriter.upload(postageBatchId, psReference)
  }

  private serializeUserPayload(userPayload: UserPayload): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(userPayload))
  }
}
