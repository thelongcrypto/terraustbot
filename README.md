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

# Telegram commands
## arbitrate
- hi | hello
- info | i: return information on configurations and quick stats
- balance | bl: show wallet balance
- enable autoswap | ea: autoswap LUNA -> bLUNA or vice versa when rate is met
- disable autoswap | da:
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
## limit order

# Tips to maximize benefit
- Many phones have setting to change the notification sound for different application. I have set different sound for telegram so that important messsages are not being missed and you can do the same too.
- For critical situation like LTV come close to liquidation or good arbitrate opportunity you can try continuous notification mode which send the message with sound over and over again - similar to phone call to gain your attention.

# How to setup
If below steps are still complicated for you, I am thinking about how to make deployment easier. In the mean time reach me through https://twitter.com/thelongcrypto for support.


## Production with firebase cloud function
## Local development

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