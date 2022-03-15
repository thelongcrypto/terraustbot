export class AbitrateStrategy {
  #config: Record<string, any>
  // #currentSwapTokens: Record<string, number> = {}
  #swapQuotas: Record<string, number> = {}
  //   #nextBorrowReminder = new Date('2000-01-01')
  //   #nextRepayReminder = new Date('2000-01-01')
  // #nextSwapbLUNAReminder = new Date('2000-01-01')
  // #nextSwapLUNAReminder = new Date('2000-01-01')

  static get version() {
    return '0.2.1'
  }

  constructor(config: any) {
    this.#config = config
    this.#swapQuotas = { 'LUNA-bLUNA': config.options.MAX_TOKEN_PER_BATCH }
  }

  getNumberOfTokensToSwap(tokenBalance: number): number {
    return 0
  }

  checkSwapQuota(pair: string): boolean {
    return false
  }

  resetQuota(pair: string) {
    this.#swapQuotas[pair] = this.#config.options.MAX_TOKEN_PER_BATCH
  }

  shouldSwapToken(pair: string): boolean {
    // bLUNA-LUNA, LUNA-bLUNA
    return false
  }
}
