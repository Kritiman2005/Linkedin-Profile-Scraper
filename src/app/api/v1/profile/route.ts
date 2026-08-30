import { NextRequest, NextResponse } from 'next/server'
import { profileRequestSchema } from '@/server/validators/profile.validator'
import { scrapeProfile } from '@/server/services/scraper.service'
import { ScraperError } from '@/server/lib/errors'
import { supabase } from '@/server/lib/supabase'
import { z } from 'zod'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = profileRequestSchema.parse(body)

    // 1. Check Cache
    if (supabase) {
      const { data: cachedProfile, error } = await supabase
        .from('profile_cache')
        .select('*')
        .eq('linkedin_url', parsed.linkedinUrl)
        .single()
        
      if (!error && cachedProfile && cachedProfile.data) {
        // Optional: Check if cache is fresh (e.g. within 24 hours)
        const scrapedAt = new Date(cachedProfile.scraped_at)
        const ageInHours = (Date.now() - scrapedAt.getTime()) / (1000 * 60 * 60)
        
        if (ageInHours < 24) {
          console.log(`[Cache] Returning cached profile for ${parsed.linkedinUrl}`)
          return NextResponse.json({
            success: true,
            data: {
              ...cachedProfile.data,
              cached: true,
              scrapedAt: cachedProfile.scraped_at
            }
          })
        }
      }
    }

    // 2. Scrape Profile
    const liAt = parsed.liAt || process.env.LINKEDIN_LI_AT || '';
    const jsessionid = parsed.jsessionid || process.env.LINKEDIN_JSESSIONID || '';
    const userAgent = parsed.userAgent || '';
    const result = await scrapeProfile(parsed.linkedinUrl, liAt, jsessionid, userAgent)

    if (!result.success) {
      return NextResponse.json(result, { status: 422 })
    }
    
    // 3. Save to Cache
    if (supabase && result.success && result.data) {
      const { error: upsertError } = await supabase
        .from('profile_cache')
        .upsert({
          linkedin_url: parsed.linkedinUrl,
          data: result.data,
          scraped_at: new Date().toISOString()
        }, { onConflict: 'linkedin_url' })
        
      if (upsertError) {
        console.error('[Cache] Failed to save profile:', upsertError)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 })
    }
    if (error instanceof ScraperError) {
      return NextResponse.json({ error: error.message }, { status: (error as ScraperError).status })
    }
    const msg = error instanceof Error ? error.message : 'Internal Server Error'
    console.error('Error in profile route:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}