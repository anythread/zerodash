import { Utils } from '@ethersphere/bee-js'
import { Signer as BeeJsSigner, Reference } from '@ethersphere/bee-js'

export { BeeJsSigner }
export declare type FlavoredType<Type, Name> = Type & {
  __tag__?: Name
}

export interface Bytes<Length extends number> extends Uint8Array {
  readonly length: Length
}

export type EthAddress = Utils.HexString<20>

export interface GraffitiFeedRecord {
  iaasIdentifier: EthAddress
}

export type Signer = BeeJsSigner | Uint8Array | string

export interface AnyThreadComment {
  // removed `ethAddress` from the interface
  /** text of the message */
  text: string
  /** creation time of the comment */
  timestamp: number
  /** content hash to which the message originally sent */
  contentHash: Reference
  /** uploaded data with the message */
  attachment?: {
    reference: Reference
    blobType: string
  }
}
