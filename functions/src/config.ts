export default {
  // This should be your wallet mnemonic (24 words).
  mnemonic: process.env.MNEMONIC || '',
  mainnet: +process.env.MAINNET! == 1,
  // This is Terra Blockchain information
  lcdUrl: +process.env.MAINNET! == 1 ? process.env.MAINNET_LCD_URL : process.env.TESTNET_LCD_URL,
  chainId: +process.env.MAINNET! == 1 ? process.env.MAINNET_CHAIN_ID : process.env.TESTNET_CHAIN_ID,
  addresses: {
    lunablunaAddress:
      +process.env.MAINNET! == 1
        ? process.env.MAINNET_ASTRO_PAIR_TOKEN_ADDRESS
        : process.env.TESTNET_ASTRO_PAIR_TOKEN_ADDRESS,
    blunaAddress:
      +process.env.MAINNET! == 1
        ? process.env.MAINNET_BLUNA_TOKEN_ADDRESS
        : process.env.TESTNET_BLUNA_TOKEN_ADDRESS,
  },

  // Telegram Bot information
  telegram: {
    apiKey: process.env.BOT_API_KEY,
    userId: Number(process.env.BOT_CHAT_ID),
  },

  lunabluna: {
    pair: 'lunabluna',
    minSwapRate: process.env.MINIMUM_SWAP_RATE,
    maxSpread: process.env.MAX_SPREAD,
    maxTokensPerSwap: process.env.MAX_TOKEN_PER_SWAP,
    maxTokensPerSwapExtra: process.env.MAX_TOKEN_PER_SWAP_EXTRA,
    maxSwapTokensPerBatch: process.env.MAX_TOKEN_PER_BATCH,
    swapRemindMode: process.env.SWAP_REMIND_MODE,
    // nextRemindTime: new Date('2000-01-01'),
    swappedTokens: 0,
    autoswap: process.env.AUTOSWAP,
    minSwapTokens: process.env.MIN_SWAP_TOKENS,
  },
  blunabluna: {
    pair: 'blunaluna',
    minSwapRate: process.env.MINIMUM_REVERSE_SWAP_RATE,
    maxSpread: process.env.MAX_SPREAD,
    maxTokensPerSwap: process.env.MAX_TOKEN_PER_SWAP,
    maxTokensPerSwapExtra: process.env.MAX_TOKEN_PER_SWAP_EXTRA,
    maxSwapTokensPerBatch: process.env.MAX_TOKEN_PER_BATCH,
    swapRemindMode: process.env.SWAP_REMIND_MODE,
    // nextRemindTime: new Date('2000-01-01'),
    swappedTokens: 0,
    autoswap: process.env.AUTOSWAP,
    minSwapTokens: process.env.MIN_SWAP_TOKENS,
  },
  // anchor protocol
  anchor: {
    // min UST to keep in wallet for transaction fee
    minUSTBalance: process.env.MIN_UST_BALANCE,
    minANCCompound: process.env.ANCHOR_MIN_ANC_COMPOUND,
    minLUNACompound: process.env.ANCHOR_MIN_LUNA_COMPOUND,
    minbLUNACompound: process.env.ANCHOR_MIN_BLUNA_COMPOUND,
    // nextRemindTime:
  },
  anchorborrow: {
    triggerLTV: process.env.BORROW_TRIGGER_LTV,
    targetLTV: process.env.BORROW_TARGET_LTV,
    autoExecute: process.env.BORROW_AUTO,
    // nextRemindTime:
  },
  anchorrepay: {
    triggerLTV: process.env.REPAY_TRIGGER_LTV,
    targetLTV: process.env.REPAY_TRIGGER_LTV,
    autoExecute: process.env.REPAY_AUTO,
    // nextRemindTime:
  },

  notification: {
    tty: true,
    telegram: true,
  },
}
