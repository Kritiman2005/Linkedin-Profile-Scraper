# LinkedIn Profile Scraper: The Journey

This repository contains a resilient, Next.js-based REST API that extracts public data from LinkedIn profiles. But more importantly, it documents the architectural journey of reverse-engineering LinkedIn's modern web stack to build a pure-HTTP scraper without relying on bloated headless browsers.

---

## 1. The Initial Naive Approach (DOM Parsing)

The initial idea was simple: fetch the LinkedIn profile URL and parse the HTML using Cheerio. 
However, this immediately hit a brick wall. LinkedIn protects its ecosystem fiercely. Any unauthenticated request is immediately redirected to an authwall (`/authwall?trk=bf&trkInfo=AQ...`).

To bypass this, we needed to authenticate the scraper. By inspecting network requests in a real browser, we identified the two critical cookies required to impersonate a logged-in user:
- `li_at`: The core authentication token.
- `JSESSIONID`: Used as the `csrf-token` to prevent cross-site request forgery.

By injecting these into the `fetch` headers, we successfully bypassed the authwall and retrieved the raw profile HTML.

## 2. The GraphQL Discovery

With the HTML secured, the next step was parsing the data. However, LinkedIn's DOM is an obfuscated mess of dynamic React class names (`ScFvHjK...`) that change frequently. Writing CSS selectors for this would be incredibly brittle.

Instead of parsing the DOM, we looked at the network tab. We discovered that LinkedIn's frontend doesn't render the data statically; it fetches it dynamically from an internal GraphQL endpoint: `voyagerIdentityDashProfiles`.

To replicate this API call in Node.js, we had to:
1. Parse the raw HTML to find the user's hidden internal identifier (`urn:li:fsd_profile:ACo...`).
2. Construct the GraphQL request using this URN and the exact `queryId`.
3. Pass the `JSESSIONID` cookie as the `csrf-token` header to authenticate the API call.

This worked beautifully! It returned a deeply nested, but highly structured JSON payload containing the user's full work experience, education, skills, and certifications. We built a recursive function to flatten LinkedIn's complex Entity Map and extract exactly what we needed.

## 3. The WAF Roadblock

The GraphQL approach was elegant, but it had a fatal flaw. LinkedIn employs aggressive enterprise-grade Web Application Firewalls (WAFs) and Commercial Use limits.

If a single cookie scrapes too many profiles, LinkedIn doesn't necessarily ban the account—instead, it silently throttles the GraphQL API. The endpoint still returns a `200 OK`, but the payload is entirely stripped of nested relational data (Experience, Education).

Our scraper would suddenly return empty arrays. We needed a fallback.

## 4. The RSC Breakthrough (The Fallback)

While inspecting the HTML of a throttled request, we noticed something incredible. Even when the GraphQL API rejected the request, the server-rendered HTML *still* contained the user's top-level information (Name, Headline, Current Company, Location). 

How? LinkedIn uses React Server Components (RSC).

At the very bottom of the HTML document, LinkedIn injects a massive JSON array into `window.__como_rehydration__`. This array contains the raw React virtual DOM nodes used to hydrate the page on the client side.

We built a custom parser (`como-parser.ts`) to safely evaluate this RSC payload, flatten it into text nodes, and intelligently extract the "Top Card" data. 
- We discovered that the logged-in user's mini-profile (for the navbar) is also injected into this array, so we implemented proximity-based heuristics (searching only nodes directly adjacent to the "Contact info" button) to ensure we only extracted the target user's data.
- We even wrote regex to stitch together the fragmented `rootUrl` and `suffixUrl` chunks to reconstruct company and school logos!

## 5. The Final Architecture

The result is a highly resilient, two-tier scraping pipeline:

1. **Tier 1 (GraphQL API):** The scraper attempts to hit the internal `voyager` GraphQL API to extract the complete historical profile (all past jobs, all education, skills).
2. **Tier 2 (RSC Fallback):** If the GraphQL API returns an empty shell due to WAF throttling, the scraper seamlessly catches the failure and parses the `window.__como_rehydration__` RSC payload. This guarantees that Top Card details and current roles are *always* returned.
3. **Caching Layer:** To minimize risk to the cookie, every successful scrape is cached in a Supabase PostgreSQL database for 24 hours.

---

## Setup Instructions

### Local Development

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```
2. **Configure your environment variables**:
   Create a `.env.local` file in the root directory:
   ```env
   LINKEDIN_LI_AT="your_li_at_cookie_here"
   LINKEDIN_JSESSIONID="your_jsessionid_cookie_here"
   NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
   ```
3. **Database Setup (Supabase)**:
   Run the following SQL in your Supabase SQL Editor to create the cache table, and make sure to disable Row Level Security (RLS) so the server can insert rows:
   ```sql
   CREATE TABLE profile_cache (
     id uuid primary key default gen_random_uuid(),
     linkedin_url text unique not null,
     data jsonb not null,
     scraped_at timestamptz default now()
   );
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```

### Dashboard Usage
Navigate to `http://localhost:3000`. You can paste a LinkedIn URL to scrape it.
If your `.env.local` cookies are exhausted, click the **Settings ⚙️** icon next to the Scrape button to inject fresh credentials directly via the UI on a per-request basis!

### API Documentation

**`POST /api/v1/profile`**

**Request:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/satyanadella/",
  "liAt": "optional_override_cookie",
  "jsessionid": "optional_override_cookie",
  "userAgent": "optional_override_user_agent"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profileUrl": "https://www.linkedin.com/in/satyanadella/",
    "name": "Satya Nadella",
    "headline": "Chairman and CEO at Microsoft",
    "location": "Redmond, Washington, United States",
    "experience": [...],
    "education": [...],
    "source": "api", // "api" or "rsc-fallback"
    "cached": false
  }
}
```
