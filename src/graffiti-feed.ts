import { Utils } from '@ethersphere/bee-js'
import { Wallet } from 'ethers'
import { Bytes } from './types'
import { keccak256Hash } from './utils'

export function getConsensualPrivateKey(resource: string): Bytes<32> {
  if (Utils.isHexString(resource) && resource.length === 64) {
    return Utils.hexToBytes<32>(resource)
  }

  return keccak256Hash(resource)
}

export function getGraffitiWallet(consensualPrivateKey: Bytes<32>): Wallet {
  return new Wallet(Buffer.from(consensualPrivateKey))
}

export function serializeGraffitiRecord(record: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record))
}
