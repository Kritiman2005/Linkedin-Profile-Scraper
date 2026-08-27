-- Create the API keys table
CREATE TABLE api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  key_hash text not null,          -- Store hashed, never plaintext
  label text,
  is_active boolean default true,
  created_at timestamptz default now(),
  last_used_at timestamptz
);

-- Create the request logs table
CREATE TABLE request_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid references api_keys(id),
  linkedin_url text not null,
  status text not null,             -- success | cached | error | rate_limited
  created_at timestamptz default now()
);

-- Create the profile cache table
CREATE TABLE profile_cache (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text unique not null,
  data jsonb not null,              -- This will store the full JSON response
  scraped_at timestamptz default now()
);

-- Set up Row Level Security (RLS) policies for security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_cache ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own API keys
CREATE POLICY "Users can view own api keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to insert their own API keys
CREATE POLICY "Users can insert own api keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Profile cache is read-only for public/service roles, depending on implementation
-- For a backend service doing the writing, you typically bypass RLS by using the 
-- service_role key, so we don't strictly need public write policies here.
