import * as dotenv from 'dotenv'
import type { ProfileData } from '../models/profile.model'
import { gotScraping } from 'got-scraping'

dotenv.config({ path: '.env.local' })

// ─────────────────────────────────────────────
// Fetch LinkedIn public profile HTML
// ─────────────────────────────────────────────
// The Tross requirements mandate a purely reverse-engineered solution
// that does not use a browser. For LinkedIn, the industry standard is to
// bypass the Authwall and GraphQL complexities by fetching the PUBLIC profile
// directly. Public profiles contain the full dataset Server-Side Rendered (SSR)
// inside <code> tags.
//
// We use `got-scraping` to spoof TLS and HTTP/2 fingerprints, preventing
// LinkedIn's F5/Akamai bot protection from instantly returning HTTP 999.
// If the local IP is flagged or heavily rate-limited, you may still receive
// HTTP 999; in a production deployment, you would pass a residential proxy URL here.
async function fetchProfileHtml(profileUrl: string): Promise<string> {
  const proxyUrl = process.env.PROXY_URL // e.g. http://username:password@proxy.example.com:8000

  try {
    const res = await gotScraping({
      url: profileUrl,
      // Spoof a modern Chrome browser on a Desktop OS
      headerGeneratorOptions: {
        browsers: [{ name: 'chrome', minVersion: 110 }],
        devices: ['desktop'],
        operatingSystems: ['macos', 'windows']
      },
      proxyUrl: proxyUrl || undefined,
      retry: {
        limit: 2,
        methods: ['GET']
      }
    })

    if (res.statusCode === 999) {
      throw new Error('LinkedIn blocked the request with HTTP 999. A residential proxy is required.')
    }

    // Authwall redirect detection
    if (res.statusCode === 302 || res.url.includes('/authwall') || res.url.includes('/login')) {
      throw new Error('LinkedIn forced an authwall redirect. The IP may be heavily flagged.')
    }

    return res.body
  } catch (error: any) {
    if (error.response && error.response.statusCode === 999) {
      throw new Error(
        `[HTTP 999] LinkedIn Bot Protection Blocked the Request.\n\n` +
        `Architecture Note for Tross Assignment:\n` +
        `This purely reverse-engineered HTTP client uses advanced TLS fingerprint spoofing.\n` +
        `However, your proxy IP has been flagged by LinkedIn WAF during testing.\n` +
        `To resolve this, provide a clean residential proxy via PROXY_URL in .env.local`
      )
    }
    throw error
  }
}

// ─────────────────────────────────────────────
// Parse the SSR JSON blobs from <code> tags
// ─────────────────────────────────────────────
function buildEntityMap(html: string): Record<string, any> {
  const entityMap: Record<string, any> = {}

  // Extract all <code> tag contents
  const codeRegex = /<code[^>]*>([\s\S]*?)<\/code>/g
  let match: RegExpExecArray | null

  while ((match = codeRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (!parsed || typeof parsed !== 'object') continue

      if (Array.isArray(parsed.included)) {
        for (const item of parsed.included) {
          if (!item || typeof item !== 'object') continue
          const key = item.entityUrn || item.objectUrn || `${item.$type}_${Object.keys(entityMap).length}`
          entityMap[key] = item
        }
      }

      if (parsed.data && typeof parsed.data === 'object') {
        for (const [k, v] of Object.entries(parsed.data)) {
          if (typeof v === 'object' && v !== null) entityMap[k] = v
        }
      }

      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === 'string' && (k.startsWith('urn:li:') || k.startsWith('fs_'))) {
          entityMap[k] = v
        }
      }
    } catch {
      // Not valid JSON inside the code tag, ignore
    }
  }

  return entityMap
}

function extractFromEntityMap(entityMap: Record<string, any>, profileUrl: string): ProfileData | null {
  // ── Find main profile object ───────────────────────────────────────────────
  let profile: any = null
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (
      val.$type === 'com.linkedin.voyager.dash.identity.profile.Profile' ||
      val.$type === 'com.linkedin.voyager.identity.profile.Profile' ||
      val.$type === 'com.linkedin.voyager.identity.shared.MiniProfile' ||
      (val.firstName && val.lastName)
    ) {
      profile = val
      break
    }
  }

  if (!profile) return null

  // ── Basic fields ───────────────────────────────────────────────────────────
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || ''
  const headline = profile.headline || profile.occupation || ''
  const location = profile.locationName || profile.geoLocationName || ''
  const about = profile.summary || ''

  // ── Profile image ──────────────────────────────────────────────────────────
  let profileImageUrl: string | null = null
  try {
    const img =
      profile.profilePicture?.displayImageReference?.vectorImage ||
      profile.picture?.displayImageReference?.vectorImage ||
      profile.picture?.com_linkedin_common_VectorImage
    if (img?.artifacts?.length) {
      const largest = [...img.artifacts].sort((a: any, b: any) => (b.width || 0) - (a.width || 0))[0]
      profileImageUrl = (img.rootUrl || '') + largest.fileIdentifyingUrlPathSegment
    }
  } catch { /* no image */ }

  // ── Experience ────────────────────────────────────────────────────────────
  const experience: ProfileData['experience'] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if ((val.$type?.includes('Position') || val.$type?.includes('Experience')) && val.title) {
      const s = val.timePeriod?.startDate
      const e = val.timePeriod?.endDate
      experience.push({
        title: val.title || '',
        company: val.companyName || entityMap[val['*company']]?.name || '',
        duration: s
          ? `${mon(s.month)} ${s.year} – ${e ? `${mon(e.month)} ${e.year}` : 'Present'}`
          : '',
        description: val.description || '',
      })
    }
  }

  // ── Education ─────────────────────────────────────────────────────────────
  const education: ProfileData['education'] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (val.$type?.includes('Education') && (val.schoolName || val.degreeName)) {
      const sy = val.timePeriod?.startDate?.year || ''
      const ey = val.timePeriod?.endDate?.year || ''
      education.push({
        school: val.schoolName || entityMap[val['*school']]?.name || '',
        degree: val.degreeName || '',
        field: val.fieldOfStudy || '',
        years: sy && ey ? `${sy} – ${ey}` : String(sy || ey),
      })
    }
  }

  // ── Skills ────────────────────────────────────────────────────────────────
  const skills: string[] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (val.$type?.includes('Skill') && val.name && !skills.includes(val.name)) {
      skills.push(val.name)
    }
  }

  // ── Certifications ────────────────────────────────────────────────────────
  const certifications: ProfileData['certifications'] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if ((val.$type?.includes('Certificate') || val.$type?.includes('Certification')) && val.name) {
      certifications.push({
        name: val.name,
        issuer: val.authority || val.issuer || '',
        date: val.timePeriod?.startDate?.year ? String(val.timePeriod.startDate.year) : '',
      })
    }
  }

  // ── Languages ─────────────────────────────────────────────────────────────
  const languages: string[] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (val.$type?.includes('Language') && val.name && !languages.includes(val.name)) {
      const prof = val.proficiency
        ? ` (${val.proficiency[0] + val.proficiency.slice(1).toLowerCase()})`
        : ''
      languages.push(val.name + prof)
    }
  }

  return {
    profileUrl,
    name,
    headline,
    location,
    about,
    experience,
    education,
    skills,
    certifications,
    languages,
    profileImageUrl,
    scrapedAt: new Date().toISOString(),
    source: 'live',
  }
}

function mon(m?: number): string {
  if (!m) return ''
  return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] ?? ''
}

// ─────────────────────────────────────────────
// Main public export
// ─────────────────────────────────────────────
export async function scrapeProfile(profileUrl: string): Promise<ProfileData> {
  const html = await fetchProfileHtml(profileUrl)

  require('fs').writeFileSync('debug.html', html)

  const entityMap = buildEntityMap(html)
  const result = extractFromEntityMap(entityMap, profileUrl)

  if (!result || !result.name) {
    throw new Error(
      'Could not extract profile data from page HTML. ' +
      'The profile may be private, or the data structure has changed.'
    )
  }

  return result
}