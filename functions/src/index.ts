import * as functions from 'firebase-functions'
import { Telegraf } from 'telegraf'
import { ArbitrateBot } from './ArbitrateBot'
import { AnchorBot } from './AnchorBot'
import config from './config'
import { BotConfig, CoinSymbol } from './BotConfig'
import dedent from 'dedent-js'
import Decimal from 'decimal.js'

const MICRO_MULTIPLIER = 1_000_000

const botConfig: BotConfig = new BotConfig(config)
const arbBot = new ArbitrateBot(botConfig)
const anchorBot = new AnchorBot(botConfig)

const tgBot = new Telegraf(process.env.BOT_API_KEY || '')

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// us-central1 is default region for firebase function
let telegramUrl = `https://us-central1-${process.env
  .GCLOUD_PROJECT!}.cloudfunctions.net/telegrambot`

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  telegramUrl = `https://${process.env.GCLOUD_PROJECT!}.loca.lt/${process.env
    .GCLOUD_PROJECT!}/us-central1/telegrambot`
}

tgBot.telegram.setWebhook(telegramUrl)

functions.logger.info(
  `log in file, not in function, running in ${
    process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'emulator' : 'cloud'
  }`,
)

tgBot.on('text', async (ctx) => {
  let [command] = ctx.message.text?.split(' ')

  if (ctx.chat.id != config.telegram.userId) {
    ctx.reply('You are not authorized.')
    return
  }

  ctx.message.text = ctx.message.text?.toLowerCase()
  command = command.toLowerCase()

  if (command === 'hello' || command === 'hi') {
    ctx.replyWithHTML(dedent`Yes! I am here for you. Try following command:
    - [hi | hello]
    - [info | i]
    - [balance | bl]
    - [enable autoswap | ea]
    - [disable autoswap | da]
    - [reset swap batch | rsb]
    - [swaprate | sr] [pair] [rate] [reversed | r] - use <i>reveserd</i> option to convert rate to 1/rate
    - [swapbatch | sb] [max batch size]
    - [snooze] [pair | type] [minutes] - pair could be lunabluna | lb | blunaluna | bl | swap
    - [swap | sw]`)
  } else if (command === 'info' || command === 'i') {
    const message = await ctx.replyWithHTML('Loading...')
    const msg = await arbBot.getInfo()
    const anchorMsg = await anchorBot.getInfo(false)
    ctx.telegram.editMessageText(
      message.chat.id,
      message.message_id,
      undefined,
      `${msg} ${anchorMsg}`,
      {
        parse_mode: 'HTML',
      },
    )
    // await arbBot.info()
  } else if (command === 'mainnet' || command === 'testnet') {
    const message = await ctx.replyWithHTML(`Switching to ${command}...`)
    await botConfig.setNetwork(command === 'mainnet')
    arbBot.initialize()
    anchorBot.initialize()

    const msg = await arbBot.getInfo()
    const anchorMsg = await anchorBot.getInfo(false)
    ctx.telegram.editMessageText(
      message.chat.id,
      message.message_id,
      undefined,
      `${msg} ${anchorMsg}`,
      {
        parse_mode: 'HTML',
      },
    )
  } else if (ctx.message.text === 'enable autoswap' || ctx.message.text === 'ea') {
    await botConfig.enableAutoswap()
    ctx.reply(`Enabled autoswap`)
    await arbBot.info()
  } else if (
    ctx.message.text === 'disable autoswap' ||
    ctx.message.text === 'da' ||
    ctx.message.text === 'panic'
  ) {
    await botConfig.disableAutoswap()
    ctx.reply(`Disabled autoswap`)
    await arbBot.info()
  } else if (ctx.message.text === 'reset swap batch' || ctx.message.text === 'rsb') {
    botConfig.resetSwapBatch()
    ctx.reply(`Resetted swap batch to ready for autoswap again`)
    await arbBot.info()
  } else if (command === 'swaprate' || command === 'sr') {
    let [, pair, rate, reversed] = ctx.message.text?.split(' ')
    if (isNaN(+rate)) {
      ctx.reply('Send a correct number to indicate swap rate')
      return
    }

    let actualRate = +rate
    if (reversed === 'r' || reversed === 'reversed') {
      actualRate = 1 / actualRate
    }

    if (pair === 'bl') {
      pair = 'blunaluna'
    } else if (pair === 'lb') {
      pair = 'lunabluna'
    }

    await botConfig.setSwapRate(pair, +actualRate.toFixed(4))

    ctx.reply(`Changed ${pair} target rate to ${+actualRate.toFixed(4)}`)

    await arbBot.info()
  } else if (command === 'swapbatch' || command === 'sb') {
    const [, maxTokens] = ctx.message.text?.split(' ')
    if (isNaN(+maxTokens)) {
      ctx.reply('Send a correct number to indicate max tokens to swap for current batch')
      return
    }
    await botConfig.setMaxTokensPerBatch(+maxTokens)

    ctx.reply(`Changed swap batch to ${maxTokens}`)

    await arbBot.info()
  } else if (command === 'snooze') {
    const [, type, minutes] = ctx.message.text?.split(' ')
    if (isNaN(+minutes)) {
      ctx.reply('Send a correct number to indicate how many minutes should be snooozed')
      return
    }
    if (type === 'blunaluna' || type === 'bl') {
      await botConfig.snooze('blunaluna', +minutes)
      ctx.reply(`Snoozed swap bLUNA->LUNA reminder for ${minutes} minutes`)
    } else if (type === 'lunabluna' || type === 'lb') {
      await botConfig.snooze('lunabluna', +minutes)
      ctx.reply(`Snoozed swap LUNA->bLUNA reminder for ${minutes} minutes`)
    } else if (type === 'swap') {
      await botConfig.snooze('', +minutes)
      ctx.reply(`Snoozed swap reminder for ${minutes} minutes`)
    }
  } else if (command === 'balance' || command === 'bl') {
    const message = await ctx.replyWithHTML('Loading...')

    arbBot.clearCache()

    const [luna, ust, bLuna] = await Promise.all([
      arbBot.getWalletBalance(CoinSymbol.LUNA),
      arbBot.getWalletBalance(CoinSymbol.UST),
      arbBot.getWalletBalance(CoinSymbol.BLUNA),
    ])

    const msg = dedent`Your balance is
		- <code>${luna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(3) || 0} Luna</code>
		- <code>${bLuna?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(3) || 0} bLuna</code>
		- <code>${ust?.amount.dividedBy(MICRO_MULTIPLIER).toFixed(3) || 0} UST</code>`

    ctx.telegram.editMessageText(message.chat.id, message.message_id, undefined, msg, {
      parse_mode: 'HTML',
    })
  } else if (command === 'swap' || command === 'sw') {
    await ctx.replyWithHTML('Checking...')
    await arbBot.execute(true)
  }
  // anchor protocol
  else if (command === 'ltv') {
    const message = await ctx.replyWithHTML('Loading...')
    const ltv = await anchorBot.computeLTV()
    ctx.telegram.editMessageText(
      message.chat.id,
      message.message_id,
      undefined,
      `Your LTV is <code>${ltv.toFixed(3)}%</code>`,
      { parse_mode: 'HTML' },
    )
  } else if (command === 'set') {
    const [, path, value] = ctx.message.text?.split(' ')
    console.log('set value', path, value)
    if (!path || !value) {
      ctx.reply('Send a path or value')
      return
    }

    anchorBot.set(path, value)
  } else if (command === 'goto') {
    const [, amount] = ctx.message.text.split(' ')

    if (isNaN(+amount)) {
      ctx.reply('Send a correct number')
      return
    }

    ctx.replyWithHTML(`Going to <code>${amount}% of LTV</code>`)
    await anchorBot.execute(new Decimal(amount), 'tgBot')
  } else if (command === 'compound') {
    const [, type] = ctx.message.text?.split(' ')

    if (!['borrow', 'earn'].includes(type)) {
      ctx.reply('You can only use this command with "borrow" or "earn" parameter')
      return
    }

    anchorBot.compound(type as 'borrow' | 'earn')
  }
})

exports.telegrambot = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .https.onRequest(async (request, response) => {
    try {
      await botConfig.loadConfig()
      arbBot.initialize()
      anchorBot.initialize()
      await tgBot.handleUpdate(request.body)
    } finally {
      arbBot.clearCache()
      arbBot.clearQueue()
      response.status(200).send()
    }
  })

exports.getinfo = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .https.onRequest(async (request, response) => {
    try {
      await botConfig.loadConfig()
      arbBot.initialize()
      anchorBot.initialize()
      await arbBot.info()
      delete botConfig.getConfig().mnemonic
      delete botConfig.getConfig().telegram
      response.status(200).send(botConfig.getConfig())
    } finally {
      arbBot.clearQueue()
      arbBot.clearCache()
    }
  })

exports.checkarb = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .https.onRequest(async (request, response) => {
    try {
      await botConfig.loadConfig()
      arbBot.initialize()
      let result = await arbBot.execute()
      response.status(200).send(result)
    } catch (e) {
      console.error(e)
    } finally {
      arbBot.clearQueue()
      arbBot.clearCache()
      response.status(200).send()
    }
  })

exports.arbbot = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .pubsub.schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      await botConfig.loadConfig()
      arbBot.initialize()
      await arbBot.execute()
    } catch (e) {
      console.error(e)
    } finally {
      arbBot.clearQueue()
      arbBot.clearCache()
    }
    return null
  })

// anchor protocol
exports.checkanchor = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .https.onRequest(async (request, response) => {
    try {
      await botConfig.loadConfig()
      anchorBot.initialize()
      await anchorBot.execute()
    } catch (e) {
      console.error(e)
    } finally {
      // anchorBot.clearQueue()
      anchorBot.clearCache()
      response.status(200).send()
    }
  })

exports.anchorbot = functions
  .runWith({ secrets: ['MNEMONIC', 'BOT_API_KEY', 'BOT_CHAT_ID'] })
  .pubsub.schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      await botConfig.loadConfig()
      anchorBot.initialize()
      await anchorBot.execute()
    } catch (e) {
      console.error(e)
    } finally {
      // anchorBot.clearQueue()
      anchorBot.clearCache()
    }
    return null
  })
