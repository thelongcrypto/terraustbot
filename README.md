# The bot for LUNAtics - with support for bLUNA arbitrate and anchor protocol
Being a LUNAtics, with developer background and now turned product manager I keep thinking about how to use the tech to make my life and everyone life easier. This effort is one of them.
- Release you from headache and worrying of liquidation by actively monitoring LTV (Loan to value) ratio, contiuous notification mode to gain your attention in critical situation and auto repay loans by withdrawing UST from Earn or Wallet or more / auto borrow to maximize yield when LTV is low
- Arbitrate LUNA and bLUNA, sell bLUNA for LUNA when rate is high and buyback bLUNA when rate is low
- Limit order to buy/sell coins in terra ecosystem at certain price
- Since I am using this bot daily, it will be maintained until otherwise stated
- Feedbacks / bugs reports / contribution are wellcome

<g-emoji class="g-emoji" alias="warning" fallback-src="https://github.githubassets.com/images/icons/emoji/unicode/26a0.png">⚠️</g-emoji> DISCLAIMER
!!! You will need to use your private key to let the bot create and sign transactions. It is highly recommend to create a dedicated wallet and I decline all responsibility if you lose any money. DYOR!
As a bonus layer for better security, I have made the code to use firebase secret for storing your private key (24-words mnemnonic phrase) so the key has no exposure in .env file or command line.
Recommend to check the bot with testnet first to gain confidence and know how to interact with the bot and how it works. See the testing section below on how.

# How it works
## 1. anchor bot
The bot will fetch your current LTV every N minutes (1 by default due to firebase function limitation).

If your LTV is higher than anchorrepay.triggerLTV (90% per default) and the option anchorrepay.autoExecute is activated the bot will try to repay the sum needed to make your LTV back at ltv.safe (85% per default).

If your LTV is lower than anchorborrow.triggerLTV (75% per default) and the option anchorborrow.autoExecute is activated, the bot will borrow more to reach the anchorborrow.targetLTV (85% per default), then it will deposit the amount borrowed into Earn to maximize yield.

## 2. arbitrate bot
Looking at this chart https://coinhall.org/charts/terra/terra1j66jatn3k50hjtg2xemnjm8s7y8dws9xqa5y8w you will see the bluna/luna rate always move within a fixed range, usually around 0.97 to 1. Interesting thing is that 1 bLUNA can be unbond in anchor to get back 1 LUNA. So when bLUNA/LUNA is less than 1, for instance at 0.98 you can exchange 100 LUNA for 102 bLUNA and unbond it to have 102 LUNA which is equivalent to 2%. This fact make us always have profit when buying bluna at the rate less than 1. Why don't we speeding up the profit making process to buy low and sell high, such as buying bLUNA when rate is 0.97 and sell when rate is 0.99 ~ 2%. This usually takes less than 21 days so you can have more loops.

The bot will fetch bluna/luna rate from astroport pool every N minutes (1 by default). If the luna/bluna or bluna/luna rate is larger than configure amount it will remind to telegram bot for you to take action. The bot also have setting to auto swap when condition hit (use `enable autoswap` command to allow bot doing this for you).

If you are #LUNAtics and a long term hodler this will make you accumulate much more LUNA, assuming each week you can arbitrate once with 1.5% profit each, a year with 52 weeks will make you at least 52*1.5% = 78%. This is also what make me love the Terra blockchain ecosystem, there are so much opportunity. I wish you prosperity in the years ahead.
# Telegram commands
## arbitrate
- hi | hello
- mainnet | testnet: switch network to mainnet or testnet
- info | i: return information on configurations and quick stats
- balance | bl: show wallet balance
- enable autoswap | ea: autoswap LUNA -> bLUNA or vice versa when rate is met
- disable autoswap | da | panic: disable autoswap
- reset swap batch | rsb: reset total swapped token to 0 to allow more swap
- swaprate | sr [pair] [rate] [reversed | r]: use <i>reveserd</i> option to convert rate to 1/rate
- swapbatch | sb [max batch size]
- snooze [pair | type] [minutes]: pair could be lunabluna | lb | blunaluna | bl | swap (for all pairs)
- swap | sw: force checking swap condition and perform swap if applicable
## anchor protocol
- info | i: information on configurations and quick stats
- ltv: show current loan to value ratio
- goto [ltv]: borrow more or repay loans using funds from wallet / anchor earn, for example `goto 50` will make LTV of borrow to 50%
- snooze [type] [minutes]: type could be anchorborrow | anchorrepay. This will delay notification until after [minutes]
- set [path] [value]: path could be anchorborrow.triggerLTV | anchorborrow.targetLTV | anchorrepay.triggerLTV | anchorrepay.targetLV | anchorborrow.autoExecute | anchorrepay.autoExecute
## limit order

# Tips to maximize benefit
- Many phones have setting to change the notification sound for different application. I have set different sound for telegram so that important messsages are not being missed and you can do the same too.
- For critical situation like LTV come close to liquidation or good arbitrate opportunity you can try continuous notification mode which send the message with sound over and over again - similar to phone call to gain your attention.

# How to setup
If below steps are still complicated for you, I am thinking about how to make deployment easier. In the mean time reach me through https://twitter.com/thelongcrypto for support. I may be able to help in my spare time.
## 1. Create firebase project and setting up variables / secrets
### 1.1 Create firebase project
https://firebase.google.com/docs/functions/get-started

### 1.2 Setting up variables / secrets
Terra Wallet 24 words phrase mnemonic phrases (MNEMONIC), telegram bot api key (BOT_API_KEY) and your telegram user id (BOT_CHAT_ID) are required.

- Chat with BotFather to create your own bot and get bot api key (token). It is a string like 5308330920:AAGAxdxXx0L4epJ7iBaNCSbC6GHwC7Nw9ii
See detail instructions here https://firebase.google.com/docs/admin/setup#initialize-sdk
- Chat with IDBot to get your user id. It is a number like 6252965263

Type following commands and input value accordingly

`firebase functions:secrets:set MNEMONIC`

`firebase functions:secrets:set BOT_API_KEY`

`firebase functions:secrets:set BOT_CHAT_ID`

## 2. Create firebase Firestore database and init data
- Create firebase Firestore database
- Import data

Get your firebase credential and put it to GOOGLE_APPLICATION_CREDENTIALS env variable. See detail instructions here https://firebase.google.com/docs/admin/setup#initialize-sdk

`export GOOGLE_APPLICATION_CREDENTIALS=...`

Going to `functions` folder and run following commands: 

`npm run import`

Check if you can see `general_config`, `mainnet_config` and `testnet_config` collections in your Firebase Firestore database.

- Backup configuration data
To backup your configuration, run `npm run export`. Backup file can be found in `config` folder

## 3. Build & deploy
Rename .env.example to .env
### 3.1 Local development
Go to `functions` folder and run `npm run build && firebase emulators:start`
### 3.2 Production with firebase cloud function
Go to `functions` folder and run `firebase deploy --only functions`

## 4. Running
If setup correctly, you can now be able to chat with telegram bot and have it responses accordingly. The default configuration is running in testnet, you can switch between testnet and mainnet anytime by sending `testnet` or `mainnet` to the telegram bot, type `i` or `info` for configuration information at a glance.

See section `Telegram commands` above for full list of commands.

### 4.1 Local environment
For telegram bot to function you will need a tunnel to expose local service to the internet. `ngrok` or `localtunnel` can be used for this.

For example `npx localtunnel --port 5001 --subdomain yoursubdomain`
Notice that subdomain should be matched with your Google Cloud Project name as it is declared in `index.js` for telegram bot webhook

```
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  telegramUrl = `https://${process.env.GCLOUD_PROJECT!}.loca.lt/${process.env
    .GCLOUD_PROJECT!}/us-central1/telegrambot`
}
```

You are free to change this though.

For more information see https://github.com/localtunnel/localtunnel

For local emulator, since firebase pub/sub not supporting for scheduled function to run function as cronjob you might want to try one of the below:
1. Use firebase shell
firebase functions:shell
firebase > setInterval(() => arbbot(), 20000)

firebase > setInterval(() => anchorbot(), 20000)

2. Explicitly request to exposed functions /checkarb and /checkanchor
watch -n 20 curl https://{yourprojectname}.loca.lt/{yourprojectname}/us-central1/checkarb
watch -n 20 curl https://{yourprojectname}.loca.lt/{yourprojectname}/us-central1/checkanchor

## Testing with testnet
If you would like to try the bot before running in production, you may want to use the Terra Testnet. You can add fake money to your Testnet Wallet using https://faucet.terra.money/.

# Roadmap
- [ ] infrastructure
    - [x] settings, store settings, read settings to firebase cloud store
    - [x] deploy to firebase cloud function for cheap and quick production setup
    - [ ] CI/CD pipeline
    - [ ] support more deployment settings such as VM, k8s, localhost...
- [ ] arbitrate bLUNA, LUNAX, yLUNA, pLUNA
    - [ ] setting strategies and paramters (low, medium, high)
    - [x] snooze
    - [ ] next batch [ | number ]: swap next batch with default max or specify new quota
    - [ ] include price chart https://quickchart.io/
    - [ ] panic mode: stop all action | or simply type panic to disable autoswap
    - [ ] super good chance alert and highlight: whatever configuration is if LUNA->bLUNA > 1.0309 or bLUNA->LUNA > 0.9 then should highlight. Also allow quick command to swap right away at the corresponding rate
    - [ ] autoswap if rate is good despite 
- [ ] swap coins (LUNA, ANC, bLUNA)
    - [ ] general
        - [x] min / max amount per swap, max amount per batch
    - [ ] get balance
        - [x] native: LUNA, UST
        - [ ] cosmos: bLUNA (done), ANC
    - [ ] limit order
        - [ ] buy with UST: buy [coin] [rate]
        - [ ] sell for UST: sell [coin] [rate]
        - [ ] swap two coins: swap [coinA] [coinB] [rate]
    - [ ] advance hodl strategy
        - [ ] sell [coin] [rate] buy [rate]
    - [ ] advance exit strategy 
        - [ ] buy [coin] [rate] sell [rate]
    - [ ] advance trading strategy
        - [ ] buy [coin] [rate] sell [rate] and repeat [unlimited | limit [n] times]

- [.] anchor
    - [x] get earn, borrow, ltv information
    - [x] auto repay loan to reduce liquidation risk
    - [x] auto borrow to maximize yield
    - [ ] auto compounding
- [ ] Chat client support
    - [x] Telegram
    - [ ] Discord
    - [ ] Slack
- [ ] telegram commands
    - [ ]

# Tips
If you can make lots of money from using the bot and want to send any tips to sponsor for my work and maintainance effort please send to following terra address `terra1yaw3ztys39rgn466sxq2ngmv2udssy248tmvuv`

# Credit
Thanks to foolproof / RomainLanz for their work from following repos
- https://github.com/foolproof/anchor-borrow-bot
- https://github.com/foolproof/terra-luna-bluna-swap-bot

They helped me to quickly bootstrap the project and get familiar with terra / anchor sdk and also how to handle smart contract in cosmos. What a pity the projects not get maintained especially not updated to new columbus-5 / bombay-12 testnet. Also my thought was that it would be great to make it deployable to serverless environment so it can benefit many other people with limited access to 24/7 hosting. Many serverless environment offer free quotas, after checking around with cloudflare worker, aws lamda function, google cloud functions and firebase functions I chose firebase functions for its simplicity and stability.