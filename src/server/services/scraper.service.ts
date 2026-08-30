import type { ProfileData, ApiResponse } from '../models/profile.model'
import { extractFromEntityMap } from '../lib/linkedin-parser'
import { extractFromComo, parseComoRehydration } from '../lib/como-parser'
import * as cheerio from 'cheerio'

export async function scrapeProfile(profileUrl: string, liAt: string, jsessionid: string, userAgent: string): Promise<ApiResponse<ProfileData>> {
  if (!liAt || !jsessionid) {
    return {
      success: false,
      error: 'Missing LinkedIn credentials in request',
      diagnostics: { statusCode: 400, responseReceived: false, htmlLength: 0, responseType: 'UNKNOWN' }
    }
  }

  const csrfToken = jsessionid.replace(/"/g, '')

  try {
    console.log(`[Scraper] Fetching HTML for ${profileUrl}...`)

    const htmlRes = await fetch(profileUrl, {
      headers: {
        'Cookie': `li_at=${liAt}; JSESSIONID="${csrfToken}";`,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'user-agent': userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Google Chrome";v="120", "Chromium";v="120", "Not?A_Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none'
      }
    })

    if (htmlRes.status === 999) {
      return { success: false, error: 'LINKEDIN_REQUEST_DENIED (Bot Protection)', diagnostics: { statusCode: 999, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
    }
    if (htmlRes.status === 302) {
      return { success: false, error: 'LINKEDIN_ANTI_BOT_REDIRECT (Account/IP Flagged)', diagnostics: { statusCode: 302, responseReceived: true, htmlLength: 0, responseType: 'DENIED' } }
    }

    const html = await htmlRes.text()

    // ─────────────────────────────────────────────
    // STEP 1: ALWAYS parse the RSC payload first.
    // It reliably gives us Top Card data: name, headline, location, current company & education.
    // ─────────────────────────────────────────────
    const rscData = extractFromComo(html, profileUrl)

    const urlObj = new URL(profileUrl)
    const username = urlObj.pathname.split('/').filter(Boolean).pop() || ''

    // ─────────────────────────────────────────────
    // STEP 2: Try to find the Profile URN for the GraphQL API call
    // ─────────────────────────────────────────────
    let profileUrn = ''

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
        const pid = (obj.publicIdentifier || obj.vanityName || '').toLowerCase()
        if (pid === username.toLowerCase()) {
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
    } else {
      // Fallback Regex for URN
      const regex1 = new RegExp(`\\\\?"selfProfileId\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?".*?\\\\?"vanityName\\\\?"\\s*:\\s*\\\\?"${username}\\\\?"`, 'i')
      const regex2 = new RegExp(`\\\\?"vanityName\\\\?"\\s*:\\s*\\\\?"${username}\\\\?".*?\\\\?"selfProfileId\\\\?"\\s*:\\s*\\\\?"([^"\\\\]+)\\\\?"`, 'i')
      const match1 = html.match(regex1)
      const match2 = html.match(regex2)
      if (match1 && match1[1]) profileUrn = match1[1]
      else if (match2 && match2[1]) profileUrn = match2[1]
    }

    // If no URN found at all, return the RSC data directly (best we can do)
    if (!profileUrn) {
      if (rscData && rscData.name) {
        return {
          success: true,
          data: { ...rscData, source: 'rsc-fallback', scrapedAt: new Date().toISOString() } as ProfileData
        }
      }
      // Last resort: title tag only
      const $ = cheerio.load(html)
      const name = $('title').text().replace('| LinkedIn', '').trim()
      if (name) {
        return {
          success: true,
          data: { profileUrl, name, headline: '', location: '', about: '', profileImageUrl: null, experience: [], education: [], skills: [], certifications: [], languages: [], source: 'html-fallback', scrapedAt: new Date().toISOString() } as ProfileData
        }
      }
      return { success: false, error: 'LINKEDIN_COMMERCIAL_USE_LIMIT_REACHED: Cannot extract any profile data. Please use a fresh LinkedIn account cookie.', diagnostics: { statusCode: 200, responseReceived: true, htmlLength: html.length, responseType: 'UNKNOWN' } }
    }

    // ─────────────────────────────────────────────
    // STEP 3: Fetch GraphQL Data
    // ─────────────────────────────────────────────
    const queryId = 'voyagerIdentityDashProfiles.b5c27c04968c409fc0ed3546575b9b7a'
    const graphqlUrl = `https://www.linkedin.com/voyager/api/graphql?includeWebMetadata=true&variables=(memberIdentity:${profileUrn})&queryId=${queryId}`

    const rawSetCookies = htmlRes.headers.get('set-cookie')
    let mergedCookies = `li_at=${liAt}; JSESSIONID="${csrfToken}";`
    if (rawSetCookies) {
      const parsedCookies = rawSetCookies.split(',').map(c => c.split(';')[0].trim()).join('; ')
      mergedCookies = `${mergedCookies} ${parsedCookies};`
    }

    const gqlRes = await fetch(graphqlUrl, {
      headers: {
        'Cookie': mergedCookies,
        'csrf-token': csrfToken,
        'accept': 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        'x-li-track': '{"clientVersion":"1.13.46267","mpVersion":"1.13.46267","osName":"web","timezoneOffset":5.5,"timezone":"Asia/Calcutta","deviceFormFactor":"DESKTOP","mpName":"voyager-web","displayDensity":1,"displayWidth":1280,"displayHeight":720}',
      }
    })

    const gqlJson = await gqlRes.json()

    // ─────────────────────────────────────────────
    // STEP 4: Flatten and Parse GraphQL Entity Map
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

    const gqlResult = extractFromEntityMap(entityMap, profileUrl)
    const gqlHasFullData = gqlResult && gqlResult.name && (gqlResult.headline || gqlResult.experience.length > 0)

    // ─────────────────────────────────────────────
    // STEP 5: Merge RSC + GraphQL into a unified result
    // RSC is always the more reliable source for:
    //   - location (often missing from GraphQL)
    //   - current company (Top Card is more concise)
    //   - education (when GraphQL is restricted)
    // GraphQL is the superior source for:
    //   - full experience history (all past jobs)
    //   - full education list
    //   - skills, certifications, languages
    // ─────────────────────────────────────────────
    if (gqlHasFullData) {
      const merged: ProfileData = {
        profileUrl,
        name:            gqlResult.name || rscData?.name || '',
        headline:        gqlResult.headline || rscData?.headline || '',
        location:        gqlResult.location || rscData?.location || '',
        about:           gqlResult.about || rscData?.about || '',
        profileImageUrl: gqlResult.profileImageUrl || rscData?.profileImageUrl || null,
        experience:      gqlResult.experience?.length > 0 ? gqlResult.experience : (rscData?.experience || []),
        education:       gqlResult.education?.length > 0 ? gqlResult.education : (rscData?.education || []),
        skills:          gqlResult.skills?.length > 0 ? gqlResult.skills : [],
        certifications:  gqlResult.certifications?.length > 0 ? gqlResult.certifications : [],
        languages:       gqlResult.languages?.length > 0 ? gqlResult.languages : [],
        source:          'api',
        scrapedAt:       new Date().toISOString()
      }
      return { success: true, data: merged }
    }

    // GraphQL was empty — fall back to RSC
    if (rscData && rscData.name) {
      return {
        success: true,
        data: { ...rscData, source: 'rsc-fallback', scrapedAt: new Date().toISOString() } as ProfileData
      }
    }

    return {
      success: false,
      error: 'LINKEDIN_COMMERCIAL_USE_LIMIT_REACHED: Your account has hit the search limit. Please use a fresh LinkedIn account cookie in your .env.local file.',
      diagnostics: { statusCode: 200, responseReceived: true, htmlLength: html.length, responseType: 'API_EMPTY_SHELL' }
    }

  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'NETWORK_ERROR',
      diagnostics: { statusCode: 500, responseReceived: false, htmlLength: 0, responseType: 'UNKNOWN' }
    }
  }
}
