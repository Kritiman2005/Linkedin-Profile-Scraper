import { z } from 'zod'

export const profileRequestSchema = z.object({
  linkedinUrl: z.string().url().refine((val) => val.includes('linkedin.com/in/'), {
    message: "Must be a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)",
  }),
  liAt: z.string().min(1, "li_at cookie is required for extraction"),
  jsessionid: z.string().min(1, "JSESSIONID cookie is required for extraction"),
  userAgent: z.string().min(1, "User-Agent string is required to prevent bot detection"),
})

export type ProfileRequest = z.infer<typeof profileRequestSchema>
