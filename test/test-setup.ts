/* eslint-disable no-console */
import { BeeDebug, PostageBatch } from '@ethersphere/bee-js'

async function sleep(ms = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default async function testsSetup(): Promise<void> {
  if (!process.env.BEE_POSTAGE) {
    try {
      console.log('Creating postage stamps...')
      const beeDebugUrl = process.env.BEE_DEBUG_API_URL || 'http://localhost:1635'
      const beeDebug = new BeeDebug(beeDebugUrl)
      try {
        process.env.BEE_POSTAGE = await beeDebug.createPostageBatch('100000', 20)
      } catch (e) {
        await sleep(2000)
        process.env.BEE_POSTAGE = (await beeDebug.getAllPostageBatch())[0].batchID
      }
      console.log('BEE_POSTAGE: ', process.env.BEE_POSTAGE)
      //wait for chunk to be usable
      let postageBatch: PostageBatch
      do {
        postageBatch = await beeDebug.getPostageBatch(process.env.BEE_POSTAGE)

        console.log('Waiting 1 sec for batch ID settlement...')
        await sleep()
      } while (!postageBatch.usable)
    } catch (e) {
      // It is possible that for unit tests the Bee nodes does not run
      // so we are only logging errors and not leaving them to propagate
      console.error(e)
    }
  }
}
