import { Utils } from '@ethersphere/bee-js'
import { Wallet } from 'ethers'
import { AnyThreadComment, BeeJsSigner, EthAddress, GraffitiFeedRecord, Signer } from './types'
export const keccak256Hash = Utils.keccak256Hash
export const hexToBytes = Utils.hexToBytes

export const bytesToHex = Utils.bytesToHex

export function feedIndexToNumber(feedIndex: string): number {
  const bytes = hexToBytes(feedIndex)
  if (bytes.length !== 8) {
    throw new Error(
      `Couldn't convert feed index string to number because the bytelength is not 8. Got: ${bytes.length}`,
    )
  }
  const dv = new DataView(bytes.buffer)

  //chop the prefix part since javascript does not handle uint64
  return dv.getUint32(4)
}

export function numberToFeedIndex(index: number): string {
  const bytes = new Uint8Array(8)
  const dv = new DataView(bytes.buffer)
  dv.setUint32(4, index)

  return Utils.bytesToHex(bytes)
}

export function getAddressOfSigner(signer: Signer): EthAddress {
  if (typeof signer === 'string') {
    return new Wallet(Buffer.from(hexToBytes(signer))).address as EthAddress
  } else if (signer instanceof Uint8Array) {
    return new Wallet(Buffer.from(signer)).address as EthAddress
  } else if (isBeeJsSigner(signer)) {
    return bytesToHex(signer.address)
  }

  throw new Error('Personal Signer object is invalid')
}

/// Assertion functions

function isBeeJsSigner(value: unknown): value is BeeJsSigner {
  const signer = value as BeeJsSigner

  return (
    signer &&
    typeof signer === 'object' &&
    typeof signer.address === 'string' &&
    typeof signer.sign === 'function'
  )
}

function isGraffitiFeedRecord(value: unknown): value is GraffitiFeedRecord {
  return value !== null && typeof value === 'object' && Object.keys(value).includes('iaasIdentifier')
}

export function assertGraffitiFeedRecord(value: unknown): asserts value is GraffitiFeedRecord {
  if (!isGraffitiFeedRecord(value)) {
    throw new Error('Value is not a valid Graffiti Feed Record')
  }
}

function isAnyThreadComment(value: unknown): value is AnyThreadComment {
  return (
    value !== null &&
    typeof value === 'object' &&
    Object.keys(value).includes('text') &&
    Object.keys(value).includes('contentHash') &&
    Object.keys(value).includes('timestamp')
  )
}

export function assertAnyThreadComment(value: unknown): asserts value is AnyThreadComment {
  if (!isAnyThreadComment(value)) {
    throw new Error('The given value is not a valid user comment')
  }
}
