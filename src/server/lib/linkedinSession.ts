function requireEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
        throw new Error(`Missing required env var: ${key}. Check .env.local against .env.example.`)
    }
    return value
}

export function getLinkedInSession() {
    const liAt = requireEnv('LINKEDIN_LI_AT')
    const jsessionId = requireEnv('LINKEDIN_JSESSIONID')
    const userAgent = requireEnv('LINKEDIN_USER_AGENT')

    return {
        cookieHeader: `li_at=${liAt}; JSESSIONID=${jsessionId}`,
        csrfToken: jsessionId.replace(/"/g, ''), // LinkedIn expects the unquoted value here
        userAgent,
    }
}