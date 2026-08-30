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
    logoUrl?: string
  }[]
  education: {
    school: string
    degree: string
    field: string
    years: string
    logoUrl?: string
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
  source: 'api' | 'cache' | 'rsc-fallback' | 'html-fallback'
}

export type LinkedInDiagnostics = {
  statusCode?: number;
  responseReceived: boolean;
  htmlLength: number;
  responseType: "PROFILE" | "LOGIN" | "CHALLENGE" | "DENIED" | "UNKNOWN" | "API_EMPTY_SHELL";
  outgoingIp?: string;
  error?: string;
};

export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; diagnostics?: LinkedInDiagnostics; error: string };
