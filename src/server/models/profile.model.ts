export interface ProfileData {
  profileUrl: string
  name: string
  headline: string
  location: string
  about: string
  experience: {
    title: string
    company: string
    duration: string
    description: string
  }[]
  education: {
    school: string
    degree: string
    field: string
    years: string
  }[]
  skills: string[]
  certifications: {
    name: string
    issuer: string
    date: string
  }[]
  languages: string[]
  profileImageUrl: string | null
  scrapedAt: string
  source: 'live' | 'cache'
}
