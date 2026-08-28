import * as dotenv from 'dotenv'
import { gotScraping } from 'got-scraping'
import type { ProfileData, ApiResponse } from '../models/profile.model'
import { extractFromEntityMap } from '../lib/linkedin-parser'

dotenv.config({ path: '.env.local' })

export async function scrapeProfile(profileUrl: string): Promise<ApiResponse<ProfileData>> {
  const liAt = process.env.LINKEDIN_LI_AT
  const jsessionid = process.env.LINKEDIN_JSESSIONID
  const userAgent = process.env.LINKEDIN_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

  if (!liAt || !jsessionid) {
    return {
      success: false,
      error: 'Missing LinkedIn credentials in .env.local',
      diagnostics: { statusCode: 500, responseReceived: false, htmlLength: 0, responseType: 'UNKNOWN' }
    }
  }

  const csrfToken = jsessionid.replace(/"/g, '')

  try {
    // ─────────────────────────────────────────────
    // STEP 1: Fetch HTML to extract URN using got-scraping (Stealth TLS)
    // ─────────────────────────────────────────────
    console.log(`[Scraper] Fetching HTML for ${profileUrl}...`)
    const htmlRes = await gotScraping({
      url: profileUrl,
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'user-agent': userAgent,
        'accept-language': 'en-US,en;q=0.9'
      },
      throwHttpErrors: false,
      followRedirect: false
    })

    if (htmlRes.statusCode === 999) {
      return { success: false, error: 'LINKEDIN_REQUEST_DENIED (Bot Protection)', diagnostics: { statusCode: 999, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
    }
    if (htmlRes.statusCode === 302) {
      return { success: false, error: 'LINKEDIN_ANTI_BOT_REDIRECT (Account/IP Flagged)', diagnostics: { statusCode: 302, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
    }
    if (htmlRes.statusCode !== 200) {
      return { success: false, error: `Failed to fetch HTML: HTTP ${htmlRes.statusCode}`, diagnostics: { statusCode: htmlRes.statusCode, responseReceived: true, htmlLength: 0, responseType: 'UNKNOWN' } }
    }

    const html = htmlRes.body

    // The username from URL
    const urlObj = new URL(profileUrl)
    const username = urlObj.pathname.split('/').filter(Boolean).pop() || ''

    let profileUrn = ''
    
    // Instead of regex matching the first URN, we parse the rehydration payload
    const { parseComoRehydration } = require('../lib/como-parser')
    const comoArr = parseComoRehydration(html)
    
    function findTargetUrn(obj: any): string | null {
        if (!obj || typeof obj !== 'object') return null
        if (Array.isArray(obj)) {
            for (const item of obj) {
                const found = findTargetUrn(item)
                if (found) return found
            }
            return null
        }
        
        if (obj['$type'] === 'com.linkedin.voyager.identity.shared.MiniProfile' || obj['$type'] === 'com.linkedin.voyager.dash.identity.profile.Profile') {
             // 1. Try to match by vanityName/publicIdentifier (case insensitive)
             const pid = (obj.publicIdentifier || obj.vanityName || '').toLowerCase()
             const targetUsername = username.toLowerCase()
             
             if (pid === targetUsername) {
                 const urn = obj.entityUrn || obj.objectUrn
                 if (urn) {
                     const match = urn.match(/urn:li:fs[a-z_]*_profile:([^:]+)/i) || urn.match(/urn:li:member:([^:]+)/i)
                     if (match) return match[1]
                 }
             }
             
             // 2. If it's a full Profile object, it's almost certainly the target user
             if (obj['$type'] === 'com.linkedin.voyager.dash.identity.profile.Profile') {
                 const urn = obj.entityUrn || obj.objectUrn
                 if (urn) {
                     const match = urn.match(/urn:li:fs[a-z_]*_profile:([^:]+)/i) || urn.match(/urn:li:member:([^:]+)/i)
                     if (match) return match[1]
                 }
             }
        }
        for (const key of Object.keys(obj)) {
            const found = findTargetUrn(obj[key])
            if (found) return found
        }
        return null
    }
    
    const targetUrn = findTargetUrn(comoArr)
    if (targetUrn) {
        profileUrn = targetUrn
        console.log(`[Scraper] Found CORRECT Target URN: ${profileUrn}`)
    } else {
        console.log(`[Scraper] Could not find Target URN for ${username} in payload!`)
    }

    if (!profileUrn) {
      console.log('[Scraper] No URN found for GraphQL. Falling back to HTML payload extraction...')
      const match2 = html.match(new RegExp(`\\\\?"vanityName\\\\?"\\s*:\\s*\\\\?"${username}\\\\?".*?\\\\?"selfProfileId\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?"`, 'i'))
      if (match2 && match2[1]) {
        profileUrn = match2[1]
      } else {
        // If even match2 fails, it means the target profile's URN is completely missing from the HTML.
        // This ONLY happens when the account is hit with the Commercial Search Limit.
        return { success: false, error: 'Failed to extract Profile URN from HTML. This confirms your account has hit the Commercial Use Search Limit and LinkedIn is hiding the profile data.', diagnostics: { statusCode: 200, responseReceived: true, htmlLength: html.length, responseType: 'UNKNOWN' } }
      }
    }

    // ─────────────────────────────────────────────
    // STEP 2: Fetch GraphQL Data
    // ─────────────────────────────────────────────
    const queryId = 'voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a'
    const graphqlUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${profileUrn})&queryId=${queryId}`

    const gqlRes = await gotScraping({
      url: graphqlUrl,
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'csrf-token': csrfToken,
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'user-agent': userAgent,
        'x-li-lang': 'en_US'
      },
      throwHttpErrors: false
    })

    if (gqlRes.statusCode !== 200) {
      return { success: false, error: `GraphQL fetch failed: HTTP ${gqlRes.statusCode}`, diagnostics: { statusCode: gqlRes.statusCode, responseReceived: true, htmlLength: 0, responseType: 'UNKNOWN' } }
    }

    const gqlJson = JSON.parse(gqlRes.body)

    // ─────────────────────────────────────────────
    // STEP 3: Flatten and Parse
    // ─────────────────────────────────────────────
    const entityMap: Record<string, any> = {}

    if (Array.isArray(gqlJson.included)) {
      for (const item of gqlJson.included) {
        if (!item || typeof item !== 'object') continue
        const key = item.entityUrn || item.objectUrn || `${item.$type}_${Object.keys(entityMap).length}`
        entityMap[key] = item
      }
    }

    if (gqlJson.data && typeof gqlJson.data === 'object') {
      for (const [k, v] of Object.entries(gqlJson.data)) {
        if (typeof v === 'object' && v !== null) entityMap[k] = v
      }
    }

    const result = extractFromEntityMap(entityMap, profileUrl)

    if (!result || !result.name) {
      console.log('[Scraper] GraphQL did not return full profile (possibly due to search limit). Falling back to HTML payload extraction...')
      const { extractFromComo } = require('../lib/como-parser')
      const fallbackResult = extractFromComo(html, profileUrl)

      if (!fallbackResult || !fallbackResult.name) {
        return { success: false, error: 'Failed to extract profile data. The account may have hit the commercial use limit.', diagnostics: { statusCode: 200, responseReceived: true, htmlLength: html.length, responseType: 'UNKNOWN' } }
      }

      return {
        success: true,
        data: {
          ...fallbackResult,
          source: 'api'
        } as ProfileData
      }
    }

    return {
      success: true,
      data: {
        ...result,
        source: 'api'
      }
    }

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'NETWORK_ERROR',
      diagnostics: { statusCode: 500, responseReceived: false, htmlLength: 0, responseType: 'UNKNOWN' }
    }
  }
}