import dedent from 'dedent-js'
import Decimal from 'decimal.js'
import {
  Coin,
  // Denom,
  LCDClient,
  MnemonicKey,
  Msg,
  MsgExecuteContract,
  Wallet,
} from '@terra-money/terra.js'
import { Logger } from './Logger'
// import util from 'util'
import { BotConfig, CoinSymbol, CoinPair } from './BotConfig'

const MICRO_MULTIPLIER = 1_000_000

type BotStatus = 'RUNNING' | 'IDLE' | 'PAUSE'

type SimulationReturnType = {
  return_amount: string
  spread_amount: string
  commission_amount: string
}

// type Simulation = {
//   beliefPrice: Decimal
//   percentage: number
// }

export class ArbitrateBot {
  #client!: LCDClient
  #config: BotConfig
  #status: BotStatus = 'IDLE'
  #wallet!: Wallet
  #cache = new Map()
  #tx: Msg[] = []
  #mainnet: boolean = false

  static get version() {
    return '0.2.1'
  }

  constructor(config: any) {
    this.#config = config
    this.#mainnet = this.#config.getConfig().mainnet
    this.initialize(true)
  }

  initialize(firstTime: boolean = false) {
    if (firstTime || this.#mainnet != this.#config.getConfig().mainnet) {
      this.#mainnet = this.#config.getConfig().mainnet

      // Initialization of the Terra Client
      this.#client = new LCDClient({
        URL: this.getConfig().lcdUrl,
        chainID: this.getConfig().chainId,
        gasPrices: '0.15uusd',
        gasAdjustment: 1.8,
      })

      console.log('ArbitrateBot', this.getConfig().lcdUrl, this.getConfig().chainId)

      if (this.getConfig().mnemonic.split(' ').length == 24) {
        this.initWallet()
      }
    }
  }

  getConfig(): Record<string, any> {
    return this.#config.getConfig()
  }

  initWallet() {
    // Initialization of the user Wallet
    const key = new MnemonicKey({ mnemonic: this.getConfig().mnemonic })
    this.#wallet = new Wallet(this.#client, key)

    // this.info();
  }

  getWallet(): Wallet {
    if (!this.#wallet) throw new Error('Wallet is not initialized')

    return this.#wallet
  }

  async getInfo(): Promise<string> {
    let [percentage, reversePercentage] = await Promise.all([
      this.getSimulationRate(),
      this.getReverseSimulationRate(),
    ])

    return dedent`<b>v${ArbitrateBot.version} - Luna &lt;&gt; bLuna Swap Bot</b>
			<b>Network:</b> <code>${this.getConfig().chainId === 'columbus-5' ? 'Mainnet' : 'Testnet'}</code>
			<b>Address:</b>
			<a href="https://finder.terra.money/${this.getConfig().chainId}/address/${
      this.getWallet().key.accAddress
    }">
				${this.getWallet().key.accAddress}
			</a>

			<b>Status:</b> <code>${this.#status}</code>
			
			<u>Swap Configuration:</u>
      - <b>Autoswap: LUNA - bLUNA </b>  <code>${
        this.getConfig()[CoinPair.LUNABLUNA].autoswap ? 'YES' : 'NO'
      }</code>
      - <b>Autoswap: bLUNA - LUNA </b>  <code>${
        this.getConfig()[CoinPair.BLUNALUNA].autoswap ? 'YES' : 'NO'
      }</code>
      - <b>Swap LUNA-bLUNA:</b> <code>${this.getConfig()[CoinPair.LUNABLUNA].minSwapRate}</code>
      - <b>Reverse swap bLUNA-LUNA:</b> <code>${
        this.getConfig()[CoinPair.BLUNALUNA].minSwapRate
      }</code>
      - <b>Max spread:</b> <code>${this.getConfig()[CoinPair.LUNABLUNA].maxSpread}%</code>
      - <b>Max token per swap:</b> <code>${
        this.getConfig()[CoinPair.LUNABLUNA].maxTokensPerSwap
      }</code>
      - <b>Max token per batch:</b> <code>${
        this.getConfig()[CoinPair.LUNABLUNA].maxSwapTokensPerBatch
      }</code>
      - <b>Swap LUNA in current batch:</b> <code>${
        this.getConfig()[CoinPair.LUNABLUNA].swappedTokens
      }</code>
      - <b>Swap bLUNA in current batch:</b> <code>${
        this.getConfig()[CoinPair.BLUNALUNA].swappedTokens
      }</code>
			
			<u>Current rate</u>
				- LUNA-bLUNA: <code>${percentage.toFixed(4)}</code> ~ <code>${(1 / percentage).toFixed(
      4,
    )}</code> ~ <code>${(
      (100 * percentage) /
      this.getConfig()[CoinPair.LUNABLUNA].minSwapRate
    ).toFixed(4)}%</code> from target <code>${
      this.getConfig()[CoinPair.LUNABLUNA].minSwapRate
    }</code> ~ <code>${(1 / this.getConfig()[CoinPair.LUNABLUNA].minSwapRate).toFixed(4)}</code>
				- bLUNA-LUNA: <code>${reversePercentage.toFixed(4)}</code> ~ <code>${(
      (100 * reversePercentage) /
      this.getConfig()[CoinPair.BLUNALUNA].minSwapRate
    ).toFixed(4)}%</code> from target <code>${
      this.getConfig()[CoinPair.BLUNALUNA].minSwapRate
    }</code>
				- Arbitrate: <code>${(
          100 *
          (this.getConfig()[CoinPair.BLUNALUNA].minSwapRate -
            1 / this.getConfig()[CoinPair.LUNABLUNA].minSwapRate)
        ).toFixed(4)}%</code>
		`
  }
  async info() {
    Logger.log(await this.getInfo())
  }

  start() {
    this.#status = 'IDLE'
    // Logger.log('Bot started')
  }

  pause() {
    this.#status = 'PAUSE'
    // Logger.log('Bot paused')
  }

  stopExecution() {
    this.#status = 'IDLE'
  }

  clearQueue() {
    this.#tx = []
  }

  clearCache() {
    this.#cache.clear()
  }

  getMaxTokenSwap(pair: string) {
    return +this.getConfig()[pair].maxTokensPerSwap * MICRO_MULTIPLIER
  }

  getMaxTokenSwapExtra(pair: string) {
    return +this.getConfig()[pair].maxTokensPerSwapExtra * MICRO_MULTIPLIER
  }

  getMinSwapTokens(pair: string) {
    return +this.getConfig()[pair].minSwapTokens * MICRO_MULTIPLIER
  }

  shouldSwap(pair: string, amount: number) {
    return (
      this.getConfig()[pair].autoswap &&
      this.getConfig()[pair].swappedTokens < this.getConfig()[pair].maxSwapTokensPerBatch &&
      amount >= this.getMinSwapTokens(pair)
    )
  }

  calculateSwapAmount(pair: string, amount: number): number {
    if (!this.shouldSwap(pair, amount)) {
      return 0
    }

    if (amount > this.getMaxTokenSwapExtra(pair)) {
      // case 1: amount is 120, max is 200, max extra is 300 => amount should be 120
      // case 1: amount is 220, max is 200, max extra is 300 => amount should be 220, because you would not want split
      // it into 200 and 20 swaps
      // case 1: amount is 231, max is 200, max extra is 300 => amount should be 200, because you would want to split
      // it into 200 and 131 swaps - for less slippage
      amount = this.getMaxTokenSwap(pair)
    }

    return amount
  }

  async onSwapConditionHit(pair: CoinPair, swapRate: number, amount: number) {
    if (this.#config.shouldRemind(pair)) {
      const [luna, ust, bluna] = await Promise.all([
        this.getWalletBalance(CoinSymbol.LUNA),
        this.getWalletBalance(CoinSymbol.UST),
        this.getWalletBalance(CoinSymbol.BLUNA),
      ])
      // in case out of balance should continuously notify to wake me up
      Logger.log(
        dedent`
        * ${this.#mainnet ? 'MAINNET' : 'TESTNET'}
        * [HIT${!this.shouldSwap(pair, amount) ? '<code>-NO SWAP</code>' : ''}] ${
          this.shouldSwap(pair, amount) ? 'Prepare to swap...' : 'Hit but do <code>no swap</code>!'
        }
        * <code>${
          pair === CoinPair.LUNABLUNA ? 'LUNA→bLUNA' : 'bLUNA→LUNA'
        }</code> hit at rate <code>${swapRate.toFixed(4)}</code> vs target <code>${new Decimal(
          +this.getConfig()[pair].minSwapRate,
        ).toFixed(4)}</code> ${
          pair === CoinPair.LUNABLUNA
            ? `~ <code>${(1 / swapRate).toFixed(4)}</code> vs <code>${(
                1 / +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate
              ).toFixed(4)}</code>`
            : ''
        }
        * Balances:
          - LUNA: <code>${luna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code> 
          - bLUNA: <code>${bluna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code>
          - UST: <code>${ust?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code>
        * Quotas:
          - LUNA swap: swapped ${this.getConfig()[CoinPair.LUNABLUNA].swappedTokens} vs max ${
          this.getConfig()[CoinPair.LUNABLUNA].maxSwapTokensPerBatch
        }
          - bLUNA swap: swapped ${this.getConfig()[CoinPair.BLUNALUNA].swappedTokens} vs max ${
          this.getConfig()[CoinPair.BLUNALUNA].maxSwapTokensPerBatch
        }`,
      )
      // update last
      await this.#config.remind(pair, 'critical')
    }
  }

  async onCheckingSwapCondition(
    swapRate: number,
    reverseSwapRate: number,
    useLogger: boolean = false,
  ) {
    const [luna, ust, bluna] = await Promise.all([
      this.getWalletBalance(CoinSymbol.LUNA),
      this.getWalletBalance(CoinSymbol.UST),
      this.getWalletBalance(CoinSymbol.BLUNA),
    ])

    
    if (useLogger) {
      const logMsg = dedent`
  * ${this.#mainnet ? 'MAINNET' : 'TESTNET'}
  * Autoswap [LUNA: ${this.getConfig()[CoinPair.LUNABLUNA].autoswap ? 'YES' : 'NO'} - bLUNA: ${
        this.getConfig()[CoinPair.BLUNALUNA].autoswap ? 'YES' : 'NO'
      }]
  * Swap rates:
    - <code>LUNA-bLUNA</code>: current ${swapRate.toFixed(4)} vs target ${new Decimal(
        +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate,
      ).toFixed(4)} ${
        swapRate >= +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate ? '<code>[OK]</code>' : ''
      } ~ ${(1 / swapRate).toFixed(4)} vs ${new Decimal(
        1 / +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate,
      ).toFixed(4)} <code>${(100*swapRate / +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate).toFixed(2)}%</code>
    - <code>bLUNA-LUNA</code>: current ${reverseSwapRate.toFixed(4)} vs target ${new Decimal(
        +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate,
      ).toFixed(4)} ${
        reverseSwapRate >= +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate
          ? '<code>[OK]</code>'
          : ''
      } <code>${(100*reverseSwapRate / +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate).toFixed(2)}%</code>
  * Balances:
    - LUNA: <code>${luna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code> 
    - bLUNA: <code>${bluna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code>
    - UST: <code>${ust?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(4)}</code>
  * Quotas:
    - LUNA swap: swapped ${this.getConfig()[CoinPair.LUNABLUNA].swappedTokens} vs max ${
        this.getConfig()[CoinPair.LUNABLUNA].maxSwapTokensPerBatch
      }
    - bLUNA swap: swapped ${this.getConfig()[CoinPair.BLUNALUNA].swappedTokens} vs max ${
        this.getConfig()[CoinPair.BLUNALUNA].maxSwapTokensPerBatch
      }`
      Logger.log(logMsg)
    } else {
      const logMsg = `${this.#mainnet ? 'MAINNET' : 'TESTNET'} AUTOSWAP[LUNA:${
        this.getConfig()[CoinPair.LUNABLUNA].autoswap ? 'YES' : 'NO'
      } - bLUNA:${this.getConfig()[CoinPair.BLUNALUNA].autoswap ? 'YES' : 'NO'}] LUNA-bLUNA: ${(
        1 / swapRate
      ).toFixed(5)} vs ${(1 / +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate).toFixed(5)}${
        swapRate >= +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate ? ' [OK]' : ''
      } (${((100 * swapRate) / +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate).toFixed(
        2,
      )}%) bLUNA-LUNA: ${reverseSwapRate.toFixed(5)} vs ${+this.getConfig()[
        CoinPair.BLUNALUNA
      ].minSwapRate.toFixed(5)}${
        reverseSwapRate >= +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate ? ' [OK]' : ''
      } (${((100 * reverseSwapRate) / +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate).toFixed(
        2,
      )}%)`
      console.log(logMsg)
    }
  }

  async onSwappingToken(pair: CoinPair, swapRate: number, amount: number) {
    Logger.log(
      `${this.#mainnet ? 'MAINNET' : 'TESTNET'}: Swapping ${
        pair === CoinPair.LUNABLUNA ? 'LUNA→bLUNA' : 'bLUNA→LUNA'
      } [<code>${(amount / MICRO_MULTIPLIER).toFixed(4)}</code> ${
        pair === CoinPair.LUNABLUNA ? 'LUNA' : 'bLUNA'
      } @ <code>${swapRate.toFixed(4)}</code>]`,
    )
    await this.#config.swapToken(pair, amount / MICRO_MULTIPLIER)
  }

  async onSwappedToken(pair: CoinPair, swapRate: number, amount: number) {
    Logger.log(
      `${this.#mainnet ? 'MAINNET' : 'TESTNET'}: Swapped ${
        pair === CoinPair.LUNABLUNA ? 'LUNA→bLUNA' : 'bLUNA→LUNA'
      } <code>${(amount / MICRO_MULTIPLIER).toFixed(4)} ${
        pair === CoinPair.LUNABLUNA ? 'LUNA' : 'bLUNA'
      }</code> @ <code>${swapRate.toFixed(4)}</code>. Total swapped ${
        this.getConfig()[pair].swappedTokens
      } - max batch ${this.getConfig()[pair].maxSwapTokensPerBatch}`,
    )
  }

  async execute(useLogger: boolean = false): Promise<any> {
    if (this.#status !== 'IDLE') {
      console.log('execute() is not in IDLE state. Exiting...')
      return
    }

    let jsonResult = {}

    try {
      this.#status = 'RUNNING'

      let [percentage, reversePercentage] = await Promise.all([
        this.getSimulationRate(),
        this.getReverseSimulationRate(),
      ])

      let [lunaBalance, bLunaBalance] = await Promise.all([
        this.getWalletBalance(CoinSymbol.LUNA),
        this.getWalletBalance(CoinSymbol.BLUNA),
      ])

      jsonResult = {
        network: this.#mainnet ? 'mainnet' : 'testnet',
        lunabluna: 1 / percentage,
        blunaluna: reversePercentage,
      }

      await this.onCheckingSwapCondition(percentage, reversePercentage, useLogger)

      const swapLuna = percentage > +this.getConfig()[CoinPair.LUNABLUNA].minSwapRate
      const swapbLuna = reversePercentage > +this.getConfig()[CoinPair.BLUNALUNA].minSwapRate
      const currentPair = swapLuna ? CoinPair.LUNABLUNA : CoinPair.BLUNALUNA
      const swapRate = swapLuna ? percentage : reversePercentage
      const coinDenom = swapLuna ? 'uluna' : 'ubluna'
      let amount = swapLuna ? +lunaBalance?.amount : +bLunaBalance?.amount

      if (swapLuna || swapbLuna) {
        await this.onSwapConditionHit(currentPair, swapRate, amount)
        const swapAmount = this.calculateSwapAmount(currentPair, amount)
        if (swapAmount > 0) {
          const swapBalance = new Coin(coinDenom, swapAmount)

          await this.onSwappingToken(currentPair, swapRate, swapAmount)

          if (swapLuna) {
            //https://agora.terra.money/t/swapping-bluna-to-ust-using-terra-js/3743/2
            this.toBroadcast([
              // this.computeIncreaseAllowanceMessage(lunaBalance),
              this.computeLunatobLunaMessage(swapBalance, swapRate),
            ])
          } else if (swapbLuna) {
            this.toBroadcast(this.computebLunaToLunaMessage(bLunaBalance, reversePercentage))
          }

          await this.broadcast()

          await this.onSwappedToken(currentPair, swapRate, swapAmount)
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      this.#cache.clear()
      this.#status = 'IDLE'
    }

    return jsonResult
  }

  async getWalletBalance(coinSymbol: CoinSymbol): Promise<Coin> {
    if (!this.#cache.has(coinSymbol)) {
      if ([CoinSymbol.LUNA, CoinSymbol.UST].includes(coinSymbol)) {
        let balance = await this.getTerraNativeWalletBalance()
        this.#cache.set(CoinSymbol.LUNA, balance.luna)
        this.#cache.set(CoinSymbol.UST, balance.ust)
      } else if (coinSymbol === CoinSymbol.BLUNA) {
        this.#cache.set(CoinSymbol.BLUNA, await this.getbLunaBalance())
      }
    }

    return this.#cache.get(coinSymbol)
  }

  async getTerraNativeWalletBalance(): Promise<{ luna: Coin; ust: Coin }> {
    if (this.#cache.has('wallet')) {
      return this.#cache.get('wallet')
    }

    const balance = await this.#client.bank.balance(this.getWallet().key.accAddress)

    const ust = balance[0].get('uusd') || new Coin('uusd', 0)
    const luna = balance[0].get('uluna') || new Coin('uluna', 0)

    this.#cache.set('wallet', { luna, ust })

    return { luna, ust }
  }

  async getbLunaBalance(): Promise<Coin> {
    if (this.#cache.has('bluna')) {
      return this.#cache.get('bluna')
    }

    const { balance } = await this.#client.wasm.contractQuery<any>(
      this.getConfig().addresses.blunaAddress,
      {
        balance: { address: this.getWallet().key.accAddress },
      },
    )

    const bluna = new Coin('ubluna', balance)
    this.#cache.set('bluna', bluna)

    return bluna
  }

  async getSimulationRate(): Promise<number> {
    const balance = await this.getWalletBalance(CoinSymbol.LUNA)
    let amount = (MICRO_MULTIPLIER * 100).toString()

    if (balance && +balance?.amount > +this.getMaxTokenSwap(CoinPair.LUNABLUNA)) {
      amount = this.getMaxTokenSwap(CoinPair.LUNABLUNA).toString()
    } else if (balance && +balance?.amount !== 0) {
      amount = balance?.amount.toString()
    }

    const rate = await this.#client.wasm.contractQuery<SimulationReturnType>(
      this.getConfig().addresses.lunablunaAddress,
      {
        simulation: {
          offer_asset: {
            amount,
            info: { native_token: { denom: 'uluna' } },
          },
        },
      },
    )

    const returnAmount = new Decimal(rate.return_amount)

    return returnAmount.dividedBy(amount).toNumber()
  }

  async getReverseSimulationRate(): Promise<number> {
    const balance = await this.getbLunaBalance()
    let amount = (MICRO_MULTIPLIER * 100).toString()

    if (balance && +balance?.amount > +this.getMaxTokenSwap(CoinPair.BLUNALUNA)) {
      amount = this.getMaxTokenSwap(CoinPair.BLUNALUNA).toString()
    } else if (balance && +balance.amount !== 0) {
      amount = balance?.amount.toString()
    }

    const rate = await this.#client.wasm.contractQuery<SimulationReturnType>(
      this.getConfig().addresses.lunablunaAddress,
      {
        simulation: {
          offer_asset: {
            amount,
            info: {
              token: { contract_addr: this.getConfig().addresses.blunaAddress },
            },
          },
        },
      },
    )

    const returnAmount = new Decimal(rate.return_amount)

    return returnAmount.dividedBy(amount).toNumber()
  }

  computeIncreaseAllowanceMessage(amount: Coin) {
    // https://github.com/CosmWasm/cw-plus/blob/main/packages/cw20/README.md
    return new MsgExecuteContract(
      this.getWallet().key.accAddress,
      this.getConfig().addresses.blunaAddress,
      {
        increase_allowance: {
          amount: amount.amount,
          spender: this.getConfig().addresses.blunaAddress,
        },
      },
      [],
    )
  }

  computebLunaToLunaMessage(amount: Coin, beliefPercentage: number) {
    const maxSpread = this.getConfig()[CoinPair.BLUNALUNA].maxSpread / 100 || '0.01'
    const beliefPrice = 1 / beliefPercentage

    const message = JSON.stringify({
      swap: {
        max_spread: String(maxSpread),
        belief_price: String(beliefPrice),
      },
    })

    return new MsgExecuteContract(
      this.getWallet().key.accAddress,
      this.getConfig().addresses.blunaAddress,
      {
        send: {
          amount: amount.amount.toString(),
          contract: this.getConfig().addresses.lunablunaAddress,
          msg: Buffer.from(message).toString('base64'),
        },
      },
    )
  }

  computeLunatobLunaMessage(amount: Coin, beliefPercentage: number) {
    const maxSpread = this.getConfig()[CoinPair.LUNABLUNA].maxSpread / 100 || '0.01'
    const beliefPrice = 1 / beliefPercentage // LUNA/bLUNA

    return new MsgExecuteContract(
      this.getWallet().key.accAddress,
      this.getConfig().addresses.lunablunaAddress,
      {
        swap: {
          offer_asset: {
            info: { native_token: { denom: 'uluna' } },
            amount: amount.amount.toString(),
          },
          max_spread: String(maxSpread),
          belief_price: String(beliefPrice),
        },
      },
      { uluna: amount.amount },
    )
  }

  private toBroadcast(message: Msg | Msg[]) {
    if (Array.isArray(message)) {
      this.#tx.push(...message)
      return
    }

    this.#tx.push(message)
  }

  private async broadcast() {
    try {
      const tx = await this.getWallet().createAndSignTx({ msgs: this.#tx })
      await this.#client.tx.broadcast(tx)
    } catch (e) {
      console.error(`An error occured\n${JSON.stringify(e)}`)
      throw e
    } finally {
      this.clearQueue()
    }
  }
}
