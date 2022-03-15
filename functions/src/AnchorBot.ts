import { dset } from 'dset'
import dedent from 'dedent-js'
import Decimal from 'decimal.js'
import {
  Coin,
  //   Denom,
  LCDClient,
  MnemonicKey,
  Msg,
  MsgExecuteContract,
  MsgSwap,
  Wallet,
} from '@terra-money/terra.js'
import {
  BlockTxBroadcastResult,
  //   TxSuccess,
  TxError,
  //   isTxError,
} from '@terra-money/terra.js'
import {
  BotConfig,
  // CoinSymbol, CoinPair
} from './BotConfig'

import {
  AddressProviderFromJson,
  Anchor,
  //   COLLATERAL_DENOMS,
  columbus5,
  MARKET_DENOMS,
  bombay12,
  BAssetAddressProviderImpl,
  bAssetAddressesColumbus5,
  bAssetAddressesBombay12,
} from '@anchor-protocol/anchor.js'
import { Logger } from './Logger'
// import { collapseTextChangeRangesAcrossMultipleVersions } from 'typescript'
import { AnchorEarn, CHAINS, NETWORKS, DENOMS } from '@anchor-protocol/anchor-earn'

const MICRO_MULTIPLIER = 1_000_000

// TODO: See if we can make it dynamic
type Channels = { main: Msg[]; tgBot: Msg[] }
type ChannelName = keyof Channels

type BotStatus = 'IDLE' | 'RUNNING' | 'PAUSE'

function isBoolean(v: any) {
  return ['true', true, '1', 1, 'false', false, '0', 0].includes(v)
}

function toBoolean(v: any) {
  return ['true', true, '1', 1].includes(v)
}

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
}

export class AnchorBot {
  #failureCount = 0
  #executeCount = 0
  #lastRunTime = new Date()
  #config: BotConfig
  #mainnet: boolean = false
  #walletDenom: any
  #anchorEarn: any
  //   #config: Record<string, any>
  #cache: Map<string, Decimal> = new Map()
  #client!: LCDClient
  #anchor!: Anchor
  #wallet!: Wallet
  #txChannels: Channels = { main: [], tgBot: [] }
  #status: BotStatus = 'IDLE'
  #addressProvider!: AddressProviderFromJson

  constructor(config: any) {
    this.#config = config
    this.#mainnet = this.#config.getConfig().mainnet

    this.initialize(true)
    // this.info()
  }

  initialize(firstTime: boolean = false) {
    if (firstTime || this.#mainnet != this.#config.getConfig().mainnet) {
      this.#mainnet = this.#config.getConfig().mainnet

      // Initialization of the Terra Client
      this.#client = new LCDClient({
        URL: this.getConfig().lcdUrl,
        chainID: this.getConfig().chainId,
        gasPrices: '0.456uusd',
        gasAdjustment: 1.6,
      })

      console.log(this.getConfig().lcdUrl, this.getConfig().chainId)

      // Initialization of the Anchor Client
      const provider = this.getConfig().chainId === 'columbus-5' ? columbus5 : bombay12
      this.#addressProvider = new AddressProviderFromJson(provider)
      this.#anchor = new Anchor(this.#client, this.#addressProvider)

      // Initialization of the user Wallet
      const key = new MnemonicKey({ mnemonic: this.getConfig().mnemonic })
      this.#wallet = new Wallet(this.#client, key)

      this.#walletDenom = {
        address: this.#wallet.key.accAddress,
        market: MARKET_DENOMS.UUSD,
      }
      if (this.getConfig().mnemonic.split(' ').length == 24) {
        this.#anchorEarn = new AnchorEarn({
          chain: CHAINS.TERRA,
          network:
            this.getConfig().chainId === 'columbus-5' ? NETWORKS.COLUMBUS_5 : NETWORKS.BOMBAY_12,
          mnemonic: this.getConfig().mnemonic,
        })
      }
    }
  }

  getConfig(): Record<string, any> {
    return this.#config.getConfig()
  }

  getInfo(fullVersion: boolean = true): string {
    const now = new Date()
    const hours = new Decimal(
      (Math.abs(now.getTime() - this.#lastRunTime.getTime()) / (1000 * 60 * 60)) % 24,
    )
    const minutes = new Decimal(
      (Math.abs(now.getTime() - this.#lastRunTime.getTime()) / (1000 * 60)) % 60,
    )
    const seconds = new Decimal((Math.abs(now.getTime() - this.#lastRunTime.getTime()) / 1000) % 60)

    return dedent`${
      fullVersion
        ? dedent`<b>v0.3.0 - Anchor Borrow / Repay Bot</b>
				<b>Execution #${this.#executeCount + 1} - last run in ${hours.toFixed(0)} hours ${minutes.toFixed(
            0,
          )} minutes ${seconds.toFixed(0)} seconds</b>
				<b>Network:</b> <code>${this.getConfig().chainId === 'columbus-5' ? 'Mainnet' : 'Testnet'}</code>
				<b>Address:</b>
				<a href="https://finder.terra.money/${this.getConfig().chainId}/address/${
            this.#wallet.key.accAddress
          }">
					${this.#wallet.key.accAddress}
				</a>`
        : ``
    }
				<b>Status:</b> <code>${this.#status}</code>

				<u>Anchor Configuration:</u>
					- <b>Auto repay:</b> <code>${this.getConfig().anchorrepay.autoExecute}</code>
					- <b>Repay trigger:</b> <code>${this.getConfig().anchorrepay.triggerLTV}%</code>
					- <b>Repay target:</b> <code>${this.getConfig().anchorrepay.targetLTV}%</code>
					- <b>Auto borrow:</b> <code>${this.getConfig().anchorborrow.autoExecute}</code>
					- <b>Borrow trigger:</b> <code>${this.getConfig().anchorborrow.triggerLTV}%</code>
					- <b>Borrow target:</b> <code>${this.getConfig().anchorborrow.targetLTV}%</code>
                    - <b>Min UST Balance:</b> <code>${this.getConfig().anchor.minUSTBalance}</code>

				<u>Compound minimums:</u>
					- <b>ANC:</b> <code>${this.getConfig().anchor.minANCCompound}</code>
					- <b>LUNA:</b> <code>${this.getConfig().anchor.minLUNACompound}</code>
					- <b>BLUNA:</b> <code>${this.getConfig().anchor.minbLUNACompound}</code>
		`
  }
  info() {
    // const borrowedValue = await this.getBorrowedValue()
    // const borrowLimit = await this.getBorrowLimit()

    // Logger.log(
    // 	dedent`
    // 		   <b>Update borrow usage information</b>
    // 		   - Borrowed <code>${borrowedValue.toFixed(3)}</code>
    // 		   - Borrow limit <code>${borrowLimit.toFixed(3)}</code>
    // 		   - Current borrow usage <code>${borrowedValue.dividedBy(borrowLimit).times(100).toFixed(3)}%</code>`
    // )

    Logger.log(this.getInfo())
  }

  set(path: string, value: any) {
    if (path === 'anchorborrow.targetLTV') {
      if (+value > 94) {
        Logger.log('You cannot go over <code>94</code>.')
        return
      }
      if (+value >= this.getConfig().anchorrepay.triggerLTV) {
        Logger.log(
          `You cannot go over ltv.repayTrigger <code>${
            this.getConfig().anchorrepay.triggerLTV
          }</code> as it might trigger auto repay immediately. `,
        )
        return
      }

      value = +value
    } else if (path === 'anchorborrow.triggerLTV') {
      value = +value
    } else if (path === 'anchorrepay.triggerLTV') {
      value = +value
    } else if (path === 'anchorrepay.targetLTV') {
      if (+value <= this.getConfig().anchorborrow.triggerLTV) {
        Logger.log(
          `You cannot go below anchorborrow.triggerLTV <code>${
            this.getConfig().anchorborrow.triggerLTV
          }</code> as it might trigger auto borrow immediately. `,
        )
        return
      }

      value = +value
    } else if (path === 'anchorborrow.autoExecute') {
      if (!isBoolean(value)) {
        Logger.log(`The value must be a boolean (true/false).`)
        return
      }

      value = toBoolean(value)
    } else if (path === 'anchorrepay.autoExecute') {
      if (!isBoolean(value)) {
        Logger.log(`The value must be a boolean (true/false).`)
        return
      }

      value = toBoolean(value)
    } else if (path === 'anchor.minANCCompound') {
      value = +value
    } else if (path === 'anchor.minLUNACompound') {
      value = +value
    } else if (path === 'anchor.minbLUNACompound') {
      value = +value
    } else {
      Logger.log(`Invalid set option, <code>${path}</code> is not a recognized option`)
      return
    }

    dset(this.getConfig(), path, value)
    Logger.log(`Configuration changed. <code>${path}</code> is now at <code>${value}</code>`)
  }

  run() {
    if (this.#status !== 'PAUSE') {
      Logger.log('Bot should be paused to run this command')
      return
    }

    this.#status = 'IDLE'
    Logger.log('Bot started')
  }

  pause() {
    this.#status = 'PAUSE'
    this.#failureCount = 0
    this.clearCache()
    this.clearQueue('main')
    this.clearQueue('tgBot')
    Logger.log('Bot paused')
  }

  async executeTest(channelName: ChannelName = 'main') {
    //this.toBroadcast(this.computeWithdrawMessage(new Decimal(100)), channelName)
    //await this.broadcast(channelName)
    await this.#anchorEarn.withdraw({ currency: DENOMS.UST, amount: '461.00' })
  }

  shouldBorrow(ltv: Decimal, goTo?: Decimal) {
    console.log(
      'shouldBorrow',
      goTo,
      ltv,
      typeof goTo !== 'undefined',
      typeof goTo !== 'undefined' && ltv.lessThan(goTo),
    )
    return (
      (typeof goTo !== 'undefined' && ltv.lessThan(goTo)) ||
      +ltv.lessThan(this.getConfig().anchorborrow.triggerLTV)
    )
  }

  shouldRepay(ltv: Decimal, goTo?: Decimal) {
    console.log(
      'shouldRepay',
      goTo,
      ltv,
      typeof goTo !== 'undefined',
      typeof goTo !== 'undefined' && ltv > goTo,
    )
    return (
      (typeof goTo !== 'undefined' && ltv.greaterThan(goTo)) ||
      +ltv.greaterThan(this.getConfig().anchorrepay.triggerLTV)
    )
  }

  async onRepayConditionHit(ustBalance: Decimal, ltv: Decimal, repayAmount: Decimal) {
    Logger.log(
      dedent`
				<b>${this.getConfig().anchorrepay.autoExecute ? 'Repaying' : 'Should repay'}</b>
				- UST balance is <code>${ustBalance.toFixed(3)} UST</code>.
				- LTV is at <code>${+ltv.toFixed(3)}%</code> which is larger than repay trigger <code>${
        this.getConfig().anchorrepay.triggerLTV
      }%</code>
				${
          this.getConfig().anchorrepay.autoExecute ? 'Repaying' : 'Should repay'
        } <code>${repayAmount.toFixed(3)} UST</code> to reach ltv <code>${
        this.getConfig().anchorrepay.targetLTV
      }%</code>...`,
    )

    // update last reminder
    await this.#config.remind('anchorrepay', 'critical')
  }
  async onBorrowConditionHit(ustBalance: Decimal, ltv: Decimal, borrowAmount: Decimal) {
    if (this.#config.shouldRemind('anchorborrow')) {
      Logger.log(
        dedent`
		<b>${this.getConfig().anchorborrow.autoExecute ? 'Borrowing' : 'Should borrow'}</b>
		- UST balance is <code>${ustBalance.toFixed(3)} UST</code>.
		- LTV is at <code>${ltv.toFixed(3)}%</code> which is less than borrow trigger <code>${
          this.getConfig().anchorborrow.triggerLTV
        }%</code>
		${
      this.getConfig().anchorborrow.autoExecute ? 'Borrowing' : 'Should borrow'
    } <code>${borrowAmount.toFixed(3)} UST</code> to reach ltv <code>${
          this.getConfig().anchorborrow.targetLTV
        }%</code>...`,
      )

      // update last reminder
      await this.#config.remind('anchorborrow', 'critical')
    }
  }

  onBorrowed(ltv: Decimal, borrowAmount: Decimal) {
    Logger.log(
      `Borrowed & Deposited <code>${borrowAmount.toFixed(
        3,
      )} UST</code>... LTV is now at <code>${ltv.toFixed(2)}%</code>`,
    )
  }

  onRepaid(ltv: Decimal, repayAmount: Decimal) {
    Logger.log(
      `Borrowed & Deposited <code>${repayAmount.toFixed(
        3,
      )} UST</code>... LTV is now at <code>${ltv.toFixed(2)}%</code>`,
    )
  }

  async execute(goTo?: Decimal, channelName: ChannelName = 'main', useLogger: boolean = false) {
    if (this.#status === 'PAUSE') {
      return
    }

    if (this.#status === 'RUNNING') {
      if (this.#failureCount >= 5) {
        Logger.log('It seems that the bot is stuck! Restarting...')
        this.pause()
        setTimeout(() => this.run(), 1000)
      }

      this.#failureCount++
      return
    }

    if (typeof goTo !== 'undefined') {
      if (
        this.getConfig().anchorrepay.autoExecute &&
        goTo >= this.getConfig().anchorrepay.triggerLTV
      ) {
        Logger.log(
          `You cannot try to go over auto repay trigger ${
            this.getConfig().anchorrepay.triggerLTV
          }%`,
        )
        return
      }

      if (
        this.getConfig().anchorborrow.autoExecute &&
        goTo <= this.getConfig().anchorborrow.triggerLTV
      ) {
        Logger.log(
          `You cannot try to go under auto borrow trigger ${
            this.getConfig().anchorborrow.triggerLTV
          }%`,
        )
        return
      }
    }

    this.#status = 'RUNNING'

    this.heartbeat(useLogger)

    //const swapRate = await this.getbLUNASwapRate()

    const performGoto = typeof goTo !== 'undefined'
    const ltv = await this.computeLTV()

    console.log('performGoto', performGoto, goTo)

    if (this.shouldBorrow(ltv, goTo)) {
      const amountToBorrow = await this.computeAmountToBorrow(goTo)
      const walletBalance = await this.getUSTBalance()

      this.onBorrowConditionHit(walletBalance, ltv, amountToBorrow)

      if (performGoto || this.getConfig().anchorborrow.autoExecute) {
        this.toBroadcast(this.computeBorrowMessage(amountToBorrow), channelName)
        this.toBroadcast(this.computeDepositMessage(amountToBorrow), channelName)
        await this.broadcast(channelName)

        const newLTV = await this.computeLTV()

        this.onBorrowed(newLTV, amountToBorrow)
      }
    } else if (this.shouldRepay(ltv, goTo)) {
      let amountToRepay = await this.computeAmountToRepay(goTo)
      const walletBalance = await this.getUSTBalance()
      this.onRepayConditionHit(walletBalance, ltv, amountToRepay)
      // must make sure to return ltv to safe ratio
      // if cannot go to safe ratio?
      // - anchor earn have x ust, need y ust to repay to move ltv
      // - if wallet have not enough y ust, how much should we withdraw, should we withdraw 1ust?
      // should not withdraw too small amount
      if (performGoto || this.getConfig().anchorrepay.autoExecute) {
        if (+walletBalance.minus(this.getConfig().anchor.minUSTBalance).lessThan(+amountToRepay)) {
          Logger.toBroadcast('Insufficient liquidity in your wallet... withdrawing...', channelName)

          // 10 is balance to pay fee
          // logic error: should specify amount of aUST instead of UST

          const amountToWithdraw = amountToRepay
            .minus(walletBalance)
            .plus(this.getConfig().anchor.minUSTBalance)
          const depositAmount = await this.getDeposit()

          if (+depositAmount.greaterThan(+amountToWithdraw)) {
            //replaced this with anchorEarn due to incorrect behavior that withdraw aUST amount instead of UST amount
            //this.toBroadcast(this.computeWithdrawMessage(amountToWithdraw), channelName)
            await this.#anchorEarn.withdraw({
              currency: DENOMS.UST,
              amount: amountToWithdraw.toFixed(3),
            })
            Logger.toBroadcast(
              `Withdrawed <code>${amountToWithdraw.toFixed(3)} UST</code>...`,
              channelName,
            )
          } else {
            Logger.toBroadcast('Insufficient deposit...', channelName)
            /*
                    Logger.toBroadcast('Insufficient deposit... trying to claim...', channelName)
                      await this.executeClaimRewards()
          
                    const ancBalance = await this.getANCBalance()
                    const ancPrice = await this.getANCPrice()
          
                    if (+ancPrice.times(ancBalance) > +amountToRepay) {
                      const quantityToSell = amountToRepay.dividedBy(ancPrice)
                      this.toBroadcast(this.computeSellANCMessage(quantityToSell), channelName)
                      Logger.toBroadcast(
                        `Sold <code>${quantityToSell.toFixed(3)} ANC</code> at <code>${ancPrice.toFixed(
                          3,
                        )} UST</code> per ANC...`,
                        channelName,
                      )
          
                      const toStake = ancBalance.minus(quantityToSell)
                      this.toBroadcast(this.computeStakeANCMessage(toStake), channelName)
                      Logger.toBroadcast(`Staked <code>${toStake.toFixed(3)} ANC</code>...`, channelName)
                    } else {
                      Logger.toBroadcast(
                        `Impossible to repay <code>${amountToRepay.toFixed(3)} UST</code>`,
                        channelName,
                      )
                      Logger.broadcast(channelName)
                      this.#txChannels['main'] = []
                      this.#status = 'IDLE'
                      this.#failureCount = 0
                      return
                    }
                    */
          }
        }

        for (let i = 0; i < 3; i++) {
          // retry max 3 times
          this.toBroadcast(this.computeRepayMessage(amountToRepay), channelName)
          let bResult = await this.broadcast(channelName)
          //console.log('broadcast result', result)
          //Logger.log(`Broadcast transaction result ${JSON.stringify(result)}, ${result.code}`)\

          if ((bResult as TxError).code == 0) {
            const newLTV = await this.computeLTV()
            this.onRepaid(newLTV, amountToRepay)
            break
          } else {
            Logger.toBroadcast(
              `Cannot Repaid <code>${amountToRepay.toFixed(3)} UST</code> to reach LTV <code>${
                goTo || this.getConfig().anchorrepay.targetLTV
              }%</code> - error ${(bResult as TxError).code} - raw_log ${bResult.raw_log}
						Retrying ${i}th`,
              channelName,
            )
          }
          Logger.broadcast(channelName)
        }
      }
    }

    this.#failureCount = 0
    this.#status = 'IDLE'
  }

  async compound(type: 'borrow' | 'earn') {
    if (this.#status === 'PAUSE') {
      Logger.log('Bot is paused, use <code>/run</code> to start it.')
      return
    }

    if (this.#status === 'RUNNING') {
      Logger.log('Already running, please retry later.')

      if (this.#failureCount >= 5) {
        Logger.log('It seems that the bot is stuck! Restarting...')
        this.pause()
        setTimeout(() => this.run(), 1000)
      }

      this.#failureCount++
      return
    }

    this.#status = 'RUNNING'

    Logger.log('Starting to compound...')

    if (!process.env.VALIDATOR_ADDRESS) {
      Logger.log('Invalid Validator Address')
      this.#status = 'IDLE'
      return
    }

    await this.executeClaimRewards()
    await sleep(6)

    const ancBalance = await this.getANCBalance()
    const ancPrice = await this.getANCPrice()

    try {
      Logger.toBroadcast(`ANC balance: <code>${ancBalance.toFixed()}</code>`, 'tgBot')

      if (+ancBalance.greaterThan(this.getConfig().anchor.minANCCompound)) {
        await this.#anchor.anchorToken
          .sellANC(ancBalance.toFixed())
          .execute(this.#wallet, { gasPrices: '0.15uusd' })
        await sleep(6)

        if (type === 'earn') {
          const amount = ancBalance.times(ancPrice)
          const msgs = this.computeDepositMessage(amount)
          const tx = await this.#wallet.createAndSignTx({
            msgs,
            feeDenoms: ['USD'],
          })
          await this.#client.tx.broadcast(tx)

          Logger.toBroadcast(`Deposited ${amount.toFixed()} UST`, 'tgBot')
          Logger.broadcast('tgBot')
          this.#status = 'IDLE'
          return
        }

        const msg = new MsgSwap(
          this.#wallet.key.accAddress,
          new Coin(
            'USD',
            ancBalance.times(ancPrice).times(MICRO_MULTIPLIER).toFixed(0, Decimal.ROUND_DOWN),
          ),
          'LUNA',
        )

        const tx = await this.#wallet.createAndSignTx({ msgs: [msg] })
        await this.#client.tx.broadcast(tx)
        await sleep(6)
        Logger.toBroadcast(`→ Swapped ANC for Luna`, 'tgBot')
      } else {
        Logger.toBroadcast(
          `→ less than <code>${this.getConfig().anchor.minANCCompound}</code>... Skipping ANC swap`,
          'tgBot',
        )
      }

      const lunaBalance = await this.getLunaBalance()
      Logger.toBroadcast(`Luna Balance: <code>${lunaBalance.toFixed()}</code>`, 'tgBot')

      if (+lunaBalance.greaterThan(this.getConfig().anchor.minLUNACompound)) {
        const msg = new MsgExecuteContract(
          this.#wallet.key.accAddress,
          this.#addressProvider.bLunaHub(),
          {
            bond: { validator: process.env.VALIDATOR_ADDRESS },
          },
          { uluna: lunaBalance.times(MICRO_MULTIPLIER).toFixed() },
        )

        const tx = await this.#wallet.createAndSignTx({
          msgs: [msg],
          feeDenoms: ['USD'],
        })
        await this.#client.tx.broadcast(tx)
        await sleep(6)

        Logger.toBroadcast(`→ Swapped Luna for bLuna`, 'tgBot')
      } else {
        Logger.toBroadcast(
          `→ less than <code>${
            this.getConfig().anchor.minLUNACompound
          }</code>... Skipping Luna swap`,
          'tgBot',
        )
      }

      const { balance } = await this.#client.wasm.contractQuery<any>(
        this.#addressProvider.bLunaToken(),
        {
          balance: { address: this.#wallet.key.accAddress },
        },
      )

      const bLunaBalance = new Decimal(balance).dividedBy(MICRO_MULTIPLIER)
      Logger.toBroadcast(`bLuna Balance: <code>${bLunaBalance.toFixed()}</code>`, 'tgBot')

      if (+bLunaBalance.greaterThan(this.getConfig().anchor.minbLUNACompound)) {
        await this.#anchor.borrow
          .provideCollateral({
            amount: bLunaBalance.toFixed(),
            bAsset: new BAssetAddressProviderImpl(
              this.getConfig().chainId === 'columbus-5'
                ? bAssetAddressesColumbus5.bLUNA
                : bAssetAddressesBombay12.bLUNA,
            ),
            market: MARKET_DENOMS.UUSD,
          })
          .execute(this.#wallet, { gasPrices: '0.15uusd' })

        Logger.toBroadcast(`→ Compounded <code>${bLunaBalance.toFixed()} bLuna</code>`, 'tgBot')
      } else {
        Logger.toBroadcast(
          `→ less than <code>${
            this.getConfig().anchor.minbLUNACompound
          }</code>... Skipping bLuna providing`,
          'tgBot',
        )
      }
    } catch (e) {
      console.log(e)
    }

    Logger.broadcast('tgBot')
    this.#status = 'IDLE'
  }

  stopExecution() {
    this.#status = 'IDLE'
  }

  clearCache() {
    this.#cache.clear()
  }

  async getbLUNASwapRate(): Promise<Decimal> {
    // https://www.npmjs.com/package/terra-sdk?activeTab=readme
    const swapRate = await this.#client.market.swapRate(new Coin('bluna', '1000000'), 'uluna')
    Logger.log(`swapRate bLUNA - LUNA = ${swapRate.amount.toFixed(3)}`)

    return swapRate.amount
  }

  async getUSTBalance(): Promise<Decimal> {
    const coins = await this.#client.bank.balance(this.#wallet.key.accAddress)
    const ustCoin = coins[0].get(MARKET_DENOMS.UUSD)

    //https://docs.terra.money/docs/develop/sdks/terra-js/coin-and-coins.html
    //coins[0].map((x) => console.log(`${x.denom}: ${x.amount}`))
    //uluna: 449994574 => actual 449.994574
    //uusd: 9530376204 => actual 9530.376204

    if (!ustCoin) {
      return new Decimal(0)
    }

    let balance = ustCoin.amount.dividedBy(MICRO_MULTIPLIER)
    //Logger.log(`UST balance <code>${balance}</code>`)

    return balance
  }

  async getLunaBalance(): Promise<Decimal> {
    const coins = await this.#client.bank.balance(this.#wallet.key.accAddress)
    const lunaCoin = coins[0].get('uluna')

    if (!lunaCoin) {
      return new Decimal(0)
    }

    let balance = lunaCoin.amount.dividedBy(MICRO_MULTIPLIER)

    Logger.log(`LUNA balance <code>${balance}</code>`)

    return balance
  }

  async computeLTV() {
    const borrowedValue = await this.getBorrowedValue()
    const borrowLimit = await this.getBorrowLimit()

    // Logger.log(
    // 	dedent`
    // 		   <b>Update borrow usage information</b>
    // 		   - Borrowed <code>${borrowedValue.toFixed(3)}</code>
    // 		   - Borrow limit <code>${borrowLimit.toFixed(3)}</code>
    // 		   - Current borrow usage <code>${borrowedValue.dividedBy(borrowLimit).times(100).toFixed(3)}%</code>`
    // )

    return borrowedValue.dividedBy(borrowLimit).times(100)
  }

  async heartbeat(useLogger: boolean = false) {
    // 30 minutes
    if (this.#config.shouldRemind('anchor')) {
      const borrowedValue = await this.getBorrowedValue()
      const borrowLimit = await this.getBorrowLimit()
      const msg = dedent`
				   <b>Execution #${this.#executeCount + 1}: Update borrow usage information</b>
				   - Borrowed <code>${borrowedValue.toFixed(3)}</code>
				   - Borrow limit <code>${borrowLimit.toFixed(3)}</code>
				   - Current borrow usage <code>${borrowedValue
             .dividedBy(borrowLimit)
             .times(100)
             .toFixed(3)}%</code>`
      if (useLogger) {
        Logger.log(msg)
      } else {
        console.log(msg)
      }

      this.#config.remind('anchor')
    }
    this.#executeCount++
    // reset after 7 days
    if (this.#executeCount >= 60 * 60 * 24 * 7) {
      this.#executeCount = 1
    }
  }

  async computeAmountToRepay(target = this.getConfig().anchorrepay.targetLTV): Promise<Decimal> {
    const borrowedValue = await this.getBorrowedValue()
    const borrowLimit = await this.getBorrowLimit()
    const amountForSafeZone = new Decimal(target).times(borrowLimit).dividedBy(100)

    return borrowedValue.minus(amountForSafeZone)
  }

  async computeAmountToBorrow(target = this.getConfig().anchorborrow.targetLTV): Promise<Decimal> {
    const borrowedValue = await this.getBorrowedValue()
    const borrowLimit = await this.getBorrowLimit()

    return new Decimal(target).times(borrowLimit).dividedBy(100).minus(borrowedValue)
  }

  async getDeposit(): Promise<Decimal> {
    let deposit = new Decimal(await this.#anchor.earn.getTotalDeposit(this.#walletDenom))
    //Logger.log(`Anchor deposited = ${deposit.toFixed(3)}`)

    return deposit
    // return this.cache('deposit', () => this.#anchor.earn.getTotalDeposit(this.#walletDenom))
  }

  async getBorrowedValue(): Promise<Decimal> {
    let borrow = new Decimal(await this.#anchor.borrow.getBorrowedValue(this.#walletDenom))
    //Logger.log(`Anchor borrowed: ${borrow.toFixed(3)}`)

    return borrow
    // return this.cache('borrowedValue', () => this.#anchor.borrow.getBorrowedValue(this.#walletDenom))
  }

  async getBorrowLimit(): Promise<Decimal> {
    let borrowLimit = new Decimal(await this.#anchor.borrow.getBorrowLimit(this.#walletDenom))
    //console.log('Borrow limit: ', borrowLimit)
    return borrowLimit
    // return this.cache('borrowLimit', () => this.#anchor.borrow.getBorrowLimit(this.#walletDenom))
  }

  async getANCBalance(): Promise<Decimal> {
    return new Decimal(await this.#anchor.anchorToken.getBalance(this.#wallet.key.accAddress))
    // return this.cache('ancBalance', () => this.#anchor.anchorToken.getBalance(this.#wallet.key.accAddress))
  }

  async getANCPrice(): Promise<Decimal> {
    return new Decimal(await this.#anchor.anchorToken.getANCPrice())
    // return this.cache('ancPrice', () => this.#anchor.anchorToken.getANCPrice())
  }

  computeBorrowMessage(amount: Decimal) {
    return this.#anchor.borrow
      .borrow({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
      .generateWithWallet(this.#wallet)
  }

  computeDepositMessage(amount: Decimal) {
    return this.#anchor.earn
      .depositStable({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
      .generateWithWallet(this.#wallet)
  }

  computeWithdrawMessage(amount: Decimal) {
    return this.#anchor.earn
      .withdrawStable({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
      .generateWithWallet(this.#wallet)
  }

  computeRepayMessage(amount: Decimal) {
    return this.#anchor.borrow
      .repay({ amount: amount.toFixed(3), market: MARKET_DENOMS.UUSD })
      .generateWithWallet(this.#wallet)
  }

  computeSellANCMessage(amount: Decimal) {
    return this.#anchor.anchorToken.sellANC(amount.toFixed(3)).generateWithWallet(this.#wallet)
  }

  computeStakeANCMessage(amount: Decimal) {
    return this.#anchor.anchorToken
      .stakeVotingTokens({ amount: amount.toFixed(3) })
      .generateWithWallet(this.#wallet)
  }

  executeClaimRewards() {
    return this.#anchor.anchorToken
      .claimUSTBorrowRewards({ market: MARKET_DENOMS.UUSD })
      .execute(this.#wallet, { gasPrices: '0.15uusd' })
  }

  private toBroadcast(message: Msg | Msg[], channelName: ChannelName) {
    if (Array.isArray(message)) {
      this.#txChannels[channelName].push(...message)
      return
    }

    this.#txChannels[channelName].push(message)
  }

  clearQueue(channelName: ChannelName) {
    this.#txChannels[channelName] = []
  }

  private async broadcast(channelName: ChannelName): Promise<BlockTxBroadcastResult> {
    let result: BlockTxBroadcastResult = {
      txhash: '',
      raw_log: '',
      gas_wanted: 1,
      gas_used: 1,
      height: 1,
      logs: [],
      code: 0,
      codespace: '',
      data: '',
      info: '',
      timestamp: '',
    }
    try {
      const tx = await this.#wallet.createAndSignTx({
        msgs: this.#txChannels[channelName],
        feeDenoms: ['USD'],
        gas: 'auto',
        gasPrices: '0.15uusd',
        gasAdjustment: 1.8,
      })
      // post to /cosmos/tx/v1beta1/txs
      result = await this.#client.tx.broadcast(tx)
      // console.log(result)
    } catch (e) {
      //["{\"@type\":\"/terra.wasm.v1beta1.MsgExecuteContract\",\"coins\":[{\"amount\":\"2676914000\",\"denom\":\"uusd\"}],\"contract\":\"terra15dwd5mj8v59wpj0wvt233mf5efdff808c5tkal\",\"execute_msg\":{\"repay_stable\":{}},\"sender\":\"terra1j3vjup74vkxpfsam9gjypfwvgydh0mj8g3vw4x\"}"]
      // {"code":3,"message":"account sequence mismatch, expected 77, got 76: incorrect account sequence: invalid request","details":[]}
      // Logger.log(
      // 	`An error occured\n${JSON.stringify(this.#txChannels[channelName])}\n${JSON.stringify(e.response.data)}`
      // )
      console.log(`exception ${JSON.stringify(e)}`)
      result.raw_log = JSON.stringify(e)
    } finally {
      this.#txChannels[channelName] = []
    }

    return result
  }

  //   private async cache(key: string, callback: () => Promise<string>) {
  //     if (this.#cache.has(key)) {
  //       return this.#cache.get(key) as Decimal
  //     }

  //     const value = new Decimal(await callback())
  //     this.#cache.set(key, value)

  //     return value
  //   }
}
