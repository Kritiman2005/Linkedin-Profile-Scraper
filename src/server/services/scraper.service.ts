import * as dotenv from 'dotenv'
import type { ProfileData, ApiResponse } from '../models/profile.model'
import { extractFromEntityMap } from '../lib/linkedin-parser'

dotenv.config({ path: '.env.local' })

export async function scrapeProfile(profileUrl: string): Promise<ApiResponse<ProfileData>> {
  const liAt = process.env.LINKEDIN_LI_AT
  const jsessionid = process.env.LINKEDIN_JSESSIONID

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
    // STEP 1: Fetch HTML to extract URN
    // ─────────────────────────────────────────────
    console.log(`[Scraper] Fetching HTML for ${profileUrl}...`)
    const htmlRes = await fetch(profileUrl, {
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'user-agent': process.env.LINKEDIN_USER_AGENT || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9'
      },
      redirect: 'manual'
    })

    if (!htmlRes.ok) {
      if (htmlRes.status === 999) {
        return { success: false, error: 'LINKEDIN_REQUEST_DENIED (Bot Protection)', diagnostics: { statusCode: 999, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
      }
      if (htmlRes.status === 302) {
        return { success: false, error: 'LINKEDIN_ANTI_BOT_REDIRECT (Account/IP Flagged)', diagnostics: { statusCode: 302, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
      }
      return { success: false, error: `Failed to fetch HTML: HTTP ${htmlRes.status}`, diagnostics: { statusCode: htmlRes.status, responseReceived: true, htmlLength: 0, responseType: 'UNKNOWN' } }
    }

    const html = await htmlRes.text()

    let profileUrn = ''

    // The username from URL
    const urlObj = new URL(profileUrl)
    const username = urlObj.pathname.split('/').filter(Boolean).pop() || ''

    const urnMatch = html.match(new RegExp(`\\\\?"selfProfileId\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?",\\s*\\\\?"vanityName\\\\?"\\s*:\\s*\\\\?"${username}\\\\?"`, 'i'))

    if (urnMatch && urnMatch[1]) {
      profileUrn = urnMatch[1]
    } else {
      const match2 = html.match(new RegExp(`\\\\?"vanityName\\\\?"\\s*:\\s*\\\\?"${username}\\\\?".*?\\\\?"selfProfileId\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?"`, 'i'))
      if (match2 && match2[1]) {
        profileUrn = match2[1]
      } else {
        // Absolute fallback: try to find any viewee urn
        const fallback = html.match(/\\"vieweeFirstName\\".*?\\"selfProfileId\\"\s*:\s*\\"([^"\\]+)\\"/)
        if (fallback && fallback[1]) {
          profileUrn = fallback[1]
        } else {
          return { success: false, error: 'Failed to extract Profile URN from HTML. The page might have changed format or the profile is private.', diagnostics: { statusCode: 200, responseReceived: true, htmlLength: html.length, responseType: 'UNKNOWN' } }
        }
      }
    }

    console.log(`[Scraper] Found URN: ${profileUrn}`)

    // ─────────────────────────────────────────────
    // STEP 2: Fetch GraphQL Data
    // ─────────────────────────────────────────────
    const queryId = 'voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a'
    const graphqlUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${profileUrn})&queryId=${queryId}`

    const gqlRes = await fetch(graphqlUrl, {
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'csrf-token': csrfToken,
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        'x-li-lang': 'en_US'
      }
    })

    if (!gqlRes.ok) {
      return { success: false, error: `GraphQL fetch failed: HTTP ${gqlRes.status}`, diagnostics: { statusCode: gqlRes.status, responseReceived: true, htmlLength: 0, responseType: 'UNKNOWN' } }
    }

    const gqlJson = await gqlRes.json()

    try { require('fs').writeFileSync('test_graphql_data.json', JSON.stringify(gqlJson, null, 2)) } catch { }

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
    // Next.js fetch polyfill throws an error if the server returns HTTP 999 (LinkedIn's anti-bot status)
    if (error && error.message && error.message.includes('init["status"] must be in the range of 200 to 599')) {
      return {
        success: false,
        error: 'LINKEDIN_REQUEST_DENIED (Bot Protection - HTTP 999)',
        diagnostics: { statusCode: 999, responseReceived: true, htmlLength: 0, responseType: 'DENIED' }
      }
    }

    return {
      success: false,
      error: error.message || 'NETWORK_ERROR',
      diagnostics: { statusCode: 500, responseReceived: false, htmlLength: 0, responseType: 'UNKNOWN' }
    }
  }
}