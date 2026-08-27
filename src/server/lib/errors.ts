export class ScraperError extends Error {
    constructor(message: string, public status: number = 502) {
        super(message)
        this.name = 'ScraperError'
    }
}

export class ProfileNotFoundError extends ScraperError {
    constructor(url: string) {
        super(`Profile not found or private: ${url}`, 404)
        this.name = 'ProfileNotFoundError'
    }
}

export class CheckpointError extends ScraperError {
    constructor() {
        super('LinkedIn returned a security checkpoint/CAPTCHA — session may need refreshing', 503)
        this.name = 'CheckpointError'
    }
}

export class RateLimitError extends ScraperError {
    constructor() {
        super('Rate limit exceeded for this API key', 429)
        this.name = 'RateLimitError'
    }
}