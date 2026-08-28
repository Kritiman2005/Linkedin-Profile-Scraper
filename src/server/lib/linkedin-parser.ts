import type { ProfileData } from '../models/profile.model'

// ─────────────────────────────────────────────
// Shared LinkedIn SSR HTML Parser
// Used by both the scraper service and the
// browser-extension passthrough endpoint.
// ─────────────────────────────────────────────

export function buildEntityMap(html: string): Record<string, any> {
  const entityMap: Record<string, any> = {}
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
      // ignore non-json code blocks
    }
  }

  return entityMap
}

export function extractFromEntityMap(entityMap: Record<string, any>, profileUrl: string): Omit<ProfileData, 'source'> | null {
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

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || ''
  const headline = profile.headline || profile.occupation || ''
  const location = profile.locationName || profile.geoLocationName || ''
  const about = profile.summary || ''

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

  const experience: ProfileData['experience'] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if ((val.$type?.includes('Position') || val.$type?.includes('Experience')) && val.title) {
      const s = val.timePeriod?.startDate
      const e = val.timePeriod?.endDate
      experience.push({
        title: val.title || '',
        company: val.companyName || entityMap[val['*company']]?.name || '',
        duration: s ? `${mon(s.month)} ${s.year} – ${e ? `${mon(e.month)} ${e.year}` : 'Present'}` : '',
        description: val.description || '',
      })
    }
  }

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

  const skills: string[] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (val.$type?.includes('Skill') && val.name && !skills.includes(val.name)) {
      skills.push(val.name)
    }
  }

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

  const languages: string[] = []
  for (const val of Object.values(entityMap)) {
    if (!val || typeof val !== 'object') continue
    if (val.$type?.includes('Language') && val.name && !languages.includes(val.name)) {
      const prof = val.proficiency
        ? ` (${val.proficiency[0] + val.proficiency.slice(1).toLowerCase()})` : ''
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
  }
}

function mon(m?: number): string {
  if (!m) return ''
  return ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m] ?? ''
}
