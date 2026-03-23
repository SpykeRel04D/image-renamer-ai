export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillInterval: number;
  private lastRefill: number;

  constructor(tokensPerMinute: number) {
    this.maxTokens = tokensPerMinute;
    this.tokens = tokensPerMinute;
    this.refillInterval = 60_000 / tokensPerMinute;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return;
    }

    const waitTime = this.refillInterval - (Date.now() - this.lastRefill);
    await new Promise(resolve => setTimeout(resolve, Math.max(waitTime, 100)));
    return this.acquire();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.refillInterval);

    if (newTokens > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }
}
