-- Create the profile cache table
CREATE TABLE profile_cache (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text unique not null,
  data jsonb not null,              -- This will store the full JSON response
  scraped_at timestamptz default now()
);

-- Set up Row Level Security (RLS) policies for security
ALTER TABLE profile_cache ENABLE ROW LEVEL SECURITY;

-- Profile cache is read-only for public/service roles, depending on implementation
-- For a backend service doing the writing, you typically bypass RLS by using the 
-- service_role key, so we don't strictly need public write policies here.

