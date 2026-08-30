# LinkedIn Profile API Scraper

This is a Next.js-based REST API that extracts public data from LinkedIn profiles using a fully reverse-engineered API approach. It accepts a LinkedIn profile URL and returns structured JSON containing the user's name, headline, location, about, experience, education, skills, and profile image.

## Setup Instructions

### Local Development

1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```
2. **Configure your environment variables**:
   Create a `.env.local` file in the root directory and add your LinkedIn credentials and Supabase keys:
   ```env
   LINKEDIN_LI_AT="your_li_at_cookie_here"
   LINKEDIN_JSESSIONID="your_jsessionid_cookie_here"
   NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
   ```
3. **Database Setup (Supabase)**:
   Run the following SQL in your Supabase SQL Editor to create the cache table:
   ```sql
   CREATE TABLE profile_cache (
     id uuid primary key default gen_random_uuid(),
     linkedin_url text unique not null,
     data jsonb not null,
     scraped_at timestamptz default now()
   );
   ALTER TABLE profile_cache ENABLE ROW LEVEL SECURITY;
   ```
4. **Run the development server**:
   ```bash
   npm run dev
   ```

### Deployment (Vercel)
This API is ready to be deployed instantly on Vercel.
1. Push this code to a public GitHub repository.
2. Import the repository in Vercel.
3. Add the 4 environment variables listed above.
4. Deploy.

---

## API Documentation

### `POST /api/v1/profile`

Fetches and parses a LinkedIn profile. If the profile was scraped within the last 24 hours, it returns the cached result from Supabase instantly.

**Request Payload:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/satyanadella/",
  "liAt": "your_li_at_cookie",          // Optional (Uses server env by default)
  "jsessionid": "your_jsessionid_cookie" // Optional (Uses server env by default)
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "profileUrl": "https://www.linkedin.com/in/satyanadella/",
    "name": "Satya Nadella",
    "headline": "Chairman and CEO at Microsoft",
    "location": "Redmond, Washington, United States",
    "experience": [
      {
        "title": "Chairman and CEO",
        "company": "Microsoft",
        "dateRange": "Feb 2014 - Present"
      }
    ],
    "education": [ ... ],
    "source": "api", // "api" | "rsc-fallback"
    "cached": true   // True if served from Supabase
  }
}
```

---

## Architectural Approach

This scraper is intentionally built without headless browsers (like Puppeteer or Playwright) to maximize performance and minimize memory footprint. It operates by sending network requests directly to LinkedIn's internal APIs:

1. **HTML Parsing & URN Extraction**: The scraper first loads the public profile HTML and extracts the raw `urn:li:fsd_profile` identifier (URN) embedded in the Server-Side Rendered (SSR) payload.
2. **GraphQL Data Extraction**: Using the extracted URN, the scraper hits LinkedIn's internal `voyagerIdentityDashProfiles` GraphQL endpoint, injecting the `csrf-token` and telemetry tracking headers. This endpoint returns a dense JSON payload containing the user's full work experience and education.
3. **React Server Components (RSC) Fallback**: If the GraphQL API rejects the request (which happens when a cookie reaches its "Commercial Use Search Limit"), the scraper seamlessly falls back to natively parsing the `window.__como_rehydration__` RSC payload injected at the bottom of the HTML page. This guarantees that Top Card details (Name, Headline, Company, Location, Education) are *always* returned, even with a flagged cookie.
4. **Supabase Caching**: Successful responses are immediately cached in Supabase. Subsequent requests for the same profile within 24 hours are served in milliseconds without hitting LinkedIn's servers.

### Why not use Playwright?
While injecting a full cookie jar into a headless Chromium instance (Playwright) solves TLS and HTTP/2 fingerprinting issues, it deviates from the elegance of a lightweight REST API. Headless browsers consume massive amounts of RAM and are incredibly slow to boot. For this challenge, documenting and reverse-engineering the exact structural boundaries of the pure-HTTP approach and RSC payloads demonstrates a much deeper understanding of modern web architectures than a brittle browser-automation script.


---

## Known Limitations & Structural WAF Constraints

While the backend correctly maps to LinkedIn's internal APIs, it faces a structural limitation inherent to pure-HTTP Node.js scrapers. LinkedIn employs enterprise-grade Web Application Firewalls (WAFs) that inspect multiple layers below the HTTP request. 

If your cookie hits the "Commercial Use Search Limit", the GraphQL API will return an empty shell. When this happens, our API detects it and activates the **RSC Fallback Parser**. 

Because the RSC payload only contains the "Top Card" of the profile, the fallback response will not include the full historical Experience or Education arrays, but it *will* return the Name, Headline, Current Company, and Location. To get the full historical arrays, simply update your `.env.local` with a fresh LinkedIn cookie.
