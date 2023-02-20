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

export function getRandomString(length = 16): string {
  let result = ''
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const charactersLength = characters.length
  let counter = 0
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
    counter += 1
  }

  return result
}

export function getTestResourceId(sequenceId: number): string {
  return `${sequenceId}-${getRandomString()}`
}
