import { NextRequest, NextResponse } from 'next/server'
import { profileRequestSchema } from '@/server/validators/profile.validator'
import { scrapeProfile } from '@/server/services/scraper.service'
import { ScraperError } from '@/server/lib/errors'
import { z } from 'zod'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = profileRequestSchema.parse(body)

    const result = await scrapeProfile(parsed.linkedinUrl, parsed.liAt, parsed.jsessionid, parsed.userAgent)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.errors }, { status: 400 })
    }
    if (error instanceof ScraperError) {
      return NextResponse.json({ error: error.message }, { status: (error as ScraperError).status })
    }
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    console.error('Error in profile route:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}