// import * as functions from 'firebase-functions'

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app')

const {
  getFirestore,
  Timestamp,
  //   FieldValue,
} = require('firebase-admin/firestore')

import { Firestore } from '@google-cloud/firestore'
import { DocumentData } from '@google-cloud/firestore'

let credential = applicationDefault()
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // for testing on local
  credential = cert(require(process.env.GOOGLE_APPLICATION_CREDENTIALS))
}

initializeApp({
  credential: credential,
})

export enum CoinSymbol {
  LUNA = 'LUNA',
  BLUNA = 'bLUNA',
  UST = 'UST',
  ANC = 'ANC',
}

export enum CoinPair {
  LUNABLUNA = 'lunabluna',
  BLUNALUNA = 'blunaluna',
  LUNAUST = 'lunaust',
  USTLUNA = 'ustluna',
  USTANC = 'ustanc',
}

export class BotConfig {
  #config: Record<string, any> = {}
  #configCollection: string = 'testnet_config'
  #db: Firestore = getFirestore()

  constructor(config: any) {
    this.#config = config
  }

  async loadConfig() {
    const general = await this.#db.collection('general_config').doc('network').get()
    this.#config.mainnet = general?.data()?.mainnet
    this.#configCollection = general?.data()?.mainnet ? 'mainnet_config' : 'testnet_config'
    this.#config.lcdUrl = general?.data()?.mainnet
      ? process.env.MAINNET_LCD_URL
      : process.env.TESTNET_LCD_URL
    this.#config.chainId = general?.data()?.mainnet
      ? process.env.MAINNET_CHAIN_ID
      : process.env.TESTNET_CHAIN_ID
    this.#config.addresses = {
      lunablunaAddress: general?.data()?.mainnet
        ? process.env.MAINNET_ASTRO_PAIR_TOKEN_ADDRESS
        : process.env.TESTNET_ASTRO_PAIR_TOKEN_ADDRESS,
      blunaAddress: general?.data()?.mainnet
        ? process.env.MAINNET_BLUNA_TOKEN_ADDRESS
        : process.env.TESTNET_BLUNA_TOKEN_ADDRESS,
    }

    const snapshot = await this.#db.collection(this.#configCollection).get()
    snapshot.forEach((doc: DocumentData) => {
      if (doc.data().pair) this.#config[doc.data().pair] = doc.data()
    })
  }

  getConfig(): Record<string, any> {
    return this.#config
  }

  async setNetwork(mainnet: boolean = false) {
    this.#config.mainnet = mainnet

    await this.#db
      .collection('general_config')
      .doc('network')
      .set({ mainnet: mainnet }, { merge: true })

    await this.loadConfig()
  }

  async setConfigValue(doc: string, field: string, value: any) {
    this.#config[doc][field] = value
    let newValue: Record<string, any> = {}
    newValue[field] = value
    await this.#db.collection(this.#configCollection).doc(doc).set(newValue, { merge: true })
  }

  async setSwapRate(pair: string, rate: number) {
    this.#config[pair].minSwapRate = rate

    await this.#db
      .collection(this.#configCollection)
      .doc(pair)
      .set({ minSwapRate: rate }, { merge: true })
  }

  async enableAutoswap(pair: string = '') {
    this.setAutoswap(pair, true)
  }

  async disableAutoswap(pair: string = '') {
    this.setAutoswap(pair, false)
  }

  async setAutoswap(pair: string = '', autoswap = false) {
    if (pair == '') {
      this.#config[CoinPair.LUNABLUNA].autoswap = autoswap
      this.#config[CoinPair.BLUNALUNA].autoswap = autoswap

      // db update
      let batch = this.#db.batch()
      batch.set(
        this.#db.collection(this.#configCollection).doc(CoinPair.LUNABLUNA),
        { autoswap: autoswap },
        { merge: true },
      )
      batch.set(
        this.#db.collection(this.#configCollection).doc(CoinPair.BLUNALUNA),
        { autoswap: autoswap },
        { merge: true },
      )
      await batch.commit()
    } else {
      this.#config[pair].autoswap = autoswap
      await this.#db
        .collection(this.#configCollection)
        .doc(pair)
        .set({ autoswap: autoswap }, { merge: true })
    }
  }

  async swapToken(pair: string, tokens: number) {
    if (pair !== CoinPair.LUNABLUNA && pair !== CoinPair.BLUNALUNA) {
      throw new Error('pair must be lunabluna or blunaluna')
    }

    this.#config[pair].swappedTokens += tokens

    // update db
    await this.#db
      .collection(this.#configCollection)
      .doc(pair)
      .set({ swappedTokens: this.#config[pair].swappedTokens }, { merge: true })
  }

  async resetSwapBatch(pair: string = '') {
    if (pair == '') {
      this.#config[CoinPair.LUNABLUNA].swappedTokens = 0
      this.#config[CoinPair.BLUNALUNA].swappedTokens = 0

      // db update
      let batch = this.#db.batch()
      batch.set(
        this.#db.collection(this.#configCollection).doc(CoinPair.LUNABLUNA),
        { swappedTokens: 0 },
        { merge: true },
      )
      batch.set(
        this.#db.collection(this.#configCollection).doc(CoinPair.BLUNALUNA),
        { swappedTokens: 0 },
        { merge: true },
      )
      await batch.commit()
    } else {
      this.#config[pair].swappedTokens = 0
      await this.#db
        .collection(this.#configCollection)
        .doc(pair)
        .set({ swappedTokens: 0 }, { merge: true })
    }
  }

  async setMaxTokensPerBatch(maxTokens: number) {
    this.#config[CoinPair.LUNABLUNA].maxSwapTokensPerBatch = maxTokens
    this.#config[CoinPair.BLUNALUNA].maxSwapTokensPerBatch = maxTokens

    // db update
    let batch = this.#db.batch()
    batch.set(
      this.#db.collection(this.#configCollection).doc(CoinPair.LUNABLUNA),
      { maxSwapTokensPerBatch: maxTokens },
      { merge: true },
    )
    batch.set(
      this.#db.collection(this.#configCollection).doc(CoinPair.BLUNALUNA),
      { maxSwapTokensPerBatch: maxTokens },
      { merge: true },
    )
    await batch.commit()
  }

  shouldRemind(pair: string): boolean {
    const now = new Date()
    return (
      this.#config[pair].nextRemindTime == undefined ||
      this.#config[pair].nextRemindTime == null ||
      now >= this.#config[pair].nextRemindTime.toDate()
    )
  }

  async snooze(pair: string, minutes: number = 30) {
    if (pair == '') {
      const arr = [CoinPair.LUNABLUNA, CoinPair.BLUNALUNA, 'anchorborrow', 'anchorrepay']
      arr.map(
        (pair) =>
          (this.#config[pair].nextRemindTime = new Timestamp(
            ((new Date().getTime() / 1000) | 0) + minutes * 60,
            0,
          )),
      )

      // db update
      let batch = this.#db.batch()
      arr.map((pair) =>
        batch.set(
          this.#db.collection(this.#configCollection).doc(pair),
          { nextRemindTime: this.#config[pair].nextRemindTime },
          { merge: true },
        ),
      )
      await batch.commit()
    } else {
      this.#config[pair].nextRemindTime = new Timestamp(
        ((new Date().getTime() / 1000) | 0) + minutes * 60,
        0,
      )
      await this.#db
        .collection(this.#configCollection)
        .doc(pair)
        .set({ nextRemindTime: this.#config[pair].nextRemindTime }, { merge: true })
    }
  }

  async remind(pair: string, remindMode: string = 'default') {
    // default 30 minutes
    let nextInterval = 30
    if (remindMode === 'critical') {
      nextInterval = 1 / 12 // 5 seconds
    }
    await this.snooze(pair, nextInterval)
  }
}
