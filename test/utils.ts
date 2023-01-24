/**
 * Returns a url for testing the Bee public API
 */
export function beeUrl(): string {
  return process.env.BEE_API_URL || 'http://localhost:1633'
}

export function getPostageBatchId(): string {
  if (!process.env.BEE_POSTAGE) throw new Error('BEE_POSTAGE env variable is not set')

  return process.env.BEE_POSTAGE
}

export async function sleep(ms = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
