import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// Mock storage for the demo (since DB is not yet provisioned)
const MOCK_API_KEY = "tk_live_mock1234567890abcdef"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return a mock key for the dashboard
  return NextResponse.json({
    keys: [
      {
        id: '1',
        key: MOCK_API_KEY,
        createdAt: new Date().toISOString(),
        isActive: true
      }
    ]
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Simulate key generation
  return NextResponse.json({
    key: MOCK_API_KEY,
    message: "New API key generated successfully."
  }, { status: 201 })
}
