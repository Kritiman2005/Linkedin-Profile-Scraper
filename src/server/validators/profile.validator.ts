import { z } from 'zod'

export const profileRequestSchema = z.object({
  linkedinUrl: z.string().url().refine((val) => val.includes('linkedin.com/in/'), {
    message: "Must be a valid LinkedIn profile URL (e.g., https://linkedin.com/in/username)",
  }),
  liAt: z.string().optional(),
  jsessionid: z.string().optional(),
  userAgent: z.string().optional(),
})

export type ProfileRequest = z.infer<typeof profileRequestSchema>
