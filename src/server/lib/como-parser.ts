import { ProfileData } from '../models/profile.model'

export function parseComoRehydration(html: string): any[] {
    const prefix = 'window.__como_rehydration__ = ['
    const startIndex = html.indexOf(prefix)
    
    if (startIndex === -1) {
        return []
    }
    
    let braceCount = 1
    let inString = false
    let escapeNext = false
    let endIndex = -1
    
    for (let i = startIndex + prefix.length; i < html.length; i++) {
        const char = html[i]
        
        if (escapeNext) {
            escapeNext = false
            continue
        }
        if (char === '\\') {
            escapeNext = true
            continue
        }
        if (char === '"') {
            inString = !inString
            continue
        }
        
        if (!inString) {
            if (char === '[') {
                braceCount++
            } else if (char === ']') {
                braceCount--
                if (braceCount === 0) {
                    endIndex = i
                    break
                }
            }
        }
    }
    
    if (endIndex === -1) {
        return []
    }
    
    const jsonStr = html.substring(startIndex + 'window.__como_rehydration__ = '.length - 1, endIndex + 1)
    try {
        return JSON.parse(jsonStr)
    } catch (e) {
        console.error('Failed to parse como rehydration', e)
        return []
    }
}

export function extractFromComo(html: string, profileUrl: string): Partial<ProfileData> | null {
    const arr = parseComoRehydration(html)
    if (!arr || arr.length === 0) return null

    let name = ''
    let headline = ''
    let location = ''
    let about = ''
    let profileImageUrl = null
    let experience: any[] = []
    let education: any[] = []
    
    const urlObj = new URL(profileUrl)
    const username = urlObj.pathname.split('/').filter(Boolean).pop() || ''
    
    // Flatten and search the array
    function search(obj: any) {
        if (!obj || typeof obj !== 'object') return
        
        if (Array.isArray(obj)) {
            for (const item of obj) search(item)
            return
        }
        
        // We look for specific entity types in SDUI or raw Profile items
        if (obj['$type'] === 'com.linkedin.voyager.dash.identity.profile.Profile' || obj['$type'] === 'com.linkedin.voyager.identity.shared.MiniProfile') {
            if (obj.firstName && obj.lastName) {
                // If it matches the username or publicIdentifier
                if (obj.publicIdentifier === username || obj.vanityName === username || profileUrl.includes(obj.publicIdentifier)) {
                    name = `${obj.firstName} ${obj.lastName}`
                    if (obj.occupation) headline = obj.occupation
                    if (obj.picture && obj.picture.com?.linkedin?.common?.VectorImage?.rootUrl) {
                        profileImageUrl = obj.picture.com.linkedin.common.VectorImage.rootUrl
                    }
                }
            }
        }
        
        // Sometimes the topcard is in a component
        if (obj.title && obj.title.text && obj.subtitle && obj.subtitle.text) {
             if (obj.title.text.includes(name) || !name) {
                 if (!name && obj.title.text.trim().split(' ').length <= 3) {
                     // Could be name
                 }
             }
        }

        // Just blindly grab things that look like experience (if they exist)
        if (obj.companyName && obj.title) {
            experience.push({
                title: obj.title,
                company: obj.companyName,
                dateRange: obj.timePeriod ? `${obj.timePeriod.startDate?.year} - ${obj.timePeriod.endDate?.year || 'Present'}` : '',
                description: obj.description || ''
            })
        }
        
        if (obj.schoolName) {
            education.push({
                school: obj.schoolName,
                degree: obj.degreeName || '',
                fieldOfStudy: obj.fieldOfStudy || '',
                dateRange: obj.timePeriod ? `${obj.timePeriod.startDate?.year} - ${obj.timePeriod.endDate?.year || ''}` : ''
            })
        }
        
        for (const key of Object.keys(obj)) {
            search(obj[key])
        }
    }
    
    search(arr)
    
    if (!name) {
        // Fallback: extract name from title tag in HTML
        const titleMatch = html.match(/<title>(.*?)\| LinkedIn<\/title>/)
        if (titleMatch) name = titleMatch[1].trim()
    }

    if (!name) return null

    return {
        profileUrl,
        name,
        headline,
        location,
        about,
        profileImageUrl,
        experience,
        education,
        skills: [],
        certifications: [],
        languages: []
    }
}
