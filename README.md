# LinkedIn Profile Scraper

**Local-First & API-Driven — Extract Clean Profile Data Without Headless Browsers**

LinkedIn Profile Scraper is an open-source, resilient REST API and Dashboard that lets you extract rich, structured JSON data from LinkedIn profiles using pure HTTP requests. It bypasses modern Web Application Firewalls (WAFs) natively, with zero reliance on bloated headless browsers.

It runs entirely on your local machine or server: local network requests, custom RSC parsers, and caching in your own Supabase instance. No third-party scraper APIs. No massive memory overhead.

---

## ✨ Features

🤖 **Dual Extraction Modes**

| Mode | What it does |
|---|---|
| **GraphQL Mode** | Primary extractor. Hits LinkedIn's internal `voyagerIdentityDashProfiles` endpoint for complete historical data (all past jobs, full education, skills, certifications). |
| **RSC Fallback Mode** | Triggered instantly if LinkedIn throttles the GraphQL payload. Evaluates the `window.__como_rehydration__` payload to extract the Top Card natively from the HTML. |

---

## 🧠 The Journey — How It Works

This project documents the architectural journey of reverse-engineering LinkedIn's modern web stack to build a pure-HTTP scraper.

### 1. The Initial Naive Approach (DOM Parsing)
The initial idea was simple: fetch the LinkedIn profile URL and parse the HTML using Cheerio. However, this immediately hit a brick wall. LinkedIn protects its ecosystem fiercely, and any unauthenticated request is redirected to an authwall. To bypass this, we authenticated the scraper by injecting the `li_at` and `JSESSIONID` cookies into the `fetch` headers, finally retrieving the raw profile HTML.

### 2. The GraphQL Discovery
With the HTML secured, parsing the DOM (an obfuscated mess of dynamic React class names) was too brittle. Instead, we inspected the network tab and discovered that LinkedIn fetches data dynamically from an internal GraphQL endpoint: `voyagerIdentityDashProfiles`. To replicate this, we extracted the user's hidden internal identifier (`urn:li:fsd_profile:ACo...`) from the HTML, forged the `csrf-token`, and successfully fetched a highly structured JSON payload containing the user's full work experience and education.

### 3. The WAF Roadblock
The GraphQL approach was elegant, but LinkedIn employs aggressive enterprise-grade Web Application Firewalls (WAFs). If a single cookie scrapes too many profiles, LinkedIn silently throttles the GraphQL API. The endpoint returns a `200 OK`, but the payload is entirely stripped of nested relational data. Our scraper would suddenly return empty arrays. We needed a fallback.

### 4. The RSC Breakthrough (The Fallback)
While inspecting the HTML of a throttled request, we noticed something incredible: the server-rendered HTML *still* contained the user's top-level information. LinkedIn uses React Server Components (RSC), injecting a massive JSON array into `window.__como_rehydration__` at the bottom of the HTML document. We built a custom parser (`como-parser.ts`) to safely evaluate this payload and intelligently extract the "Top Card" data. We even implemented proximity-based heuristics (searching only nodes directly adjacent to the "Contact info" button) to ensure we completely ignored the logged-in user's navbar profile!

### 5. The Final Architecture
The result is a highly resilient, two-tier pipeline that attempts the GraphQL API first, seamlessly falls back to the RSC payload if throttled, and caches everything in a Supabase database for 24 hours to protect the cookie.

---

## 🔌 Extracted Data 

Our scraper meticulously reverse-engineers the LinkedIn schema to rebuild a relational map of the user.

| Field | Source Priority |
|---|---|
| **Name & Headline** | GraphQL ➔ RSC Fallback ➔ HTML Title |
| **Location** | RSC Fallback ➔ GraphQL |
| **Profile Image** | GraphQL ➔ RSC Fallback |
| **Current Company** | RSC Fallback ➔ GraphQL |
| **Experience History** | GraphQL |
| **Education History** | GraphQL ➔ RSC Fallback |

## 🔒 Privacy Guarantee

- **No Third-Party Brokers.** All network calls go directly from your machine to LinkedIn.
- **Your Own Database.** Cached data is saved strictly to your own Supabase PostgreSQL instance.
- **Bring Your Own Cookies.** Authentication happens via your personal cookies, which can be injected per-request via the Dashboard UI to avoid saving them to disk.

---

## 🏗️ Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                      Next.js 15 App                      │
│                                                          │
│  ┌───────────────┐                  ┌─────────────────┐  │
│  │   UI (React)  │                  │  API Route (/v1)│  │
│  │ (page.tsx)    │◄── REST JSON ───►│ (route.ts)      │  │
│  └───────────────┘                  └───────┬─────────┘  │
│                                             │            │
│            ┌────────────────────────────────▼──┐         │
│            │          Scraper Service          │         │
│            │         (scraper.service.ts)      │         │
│            └────┬─────────────────────────┬────┘         │
│                 │                         │              │
│       ┌─────────▼───────┐      ┌──────────▼─────────┐    │
│       │ Tier 1: GraphQL │      │ Tier 2: RSC Parser │    │
│       │  (Full History) │      │  (como-parser.ts)  │    │
│       └─────────┬───────┘      └──────────┬─────────┘    │
│                 │                         │              │
└─────────────────┼─────────────────────────┼──────────────┘
                  │                         │               
        ┌─────────▼─────────────────────────▼─────────┐     
        │             LinkedIn Servers                │     
        └─────────────────────────────────────────────┘     
                  │                                         
        ┌─────────▼───────────────────────────────────┐     
        │       Supabase (PostgreSQL Cache)           │     
        └─────────────────────────────────────────────┘     
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git
- A Supabase Project (Free Tier is fine)

### 1. Clone the repository
```bash
git clone https://github.com/Kritiman2005/Linkedin-Profile-Scraper.git
cd Linkedin-Profile-Scraper
```

### 2. Install frontend dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file in the root directory:
```env
LINKEDIN_LI_AT="your_li_at_cookie_here"
LINKEDIN_JSESSIONID="your_jsessionid_cookie_here"
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your_supabase_anon_key"
```

### 4. Setup Supabase Cache
Run the following SQL in your Supabase SQL Editor:
```sql
CREATE TABLE profile_cache (
  id uuid primary key default gen_random_uuid(),
  linkedin_url text unique not null,
  data jsonb not null,
  scraped_at timestamptz default now()
);
```
*(Make sure to leave Row Level Security (RLS) disabled so the server can insert cache rows).*

### 5. Run in development mode
```bash
npm run dev
```

---

## 📁 Project Structure

```text
Linkedin-Profile-Scraper/
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main Dashboard UI
│   │   ├── layout.tsx             # Root Layout
│   │   └── api/
│   │       └── v1/profile/
│   │           └── route.ts       # Core API Endpoint
│   ├── server/
│   │   ├── lib/
│   │   │   ├── como-parser.ts     # Tier 2: RSC Rehydration Parser
│   │   │   ├── linkedin-parser.ts # Tier 1: GraphQL Entity Mapper
│   │   │   └── supabase.ts        # Database client
│   │   ├── models/
│   │   │   └── profile.model.ts   # TypeScript schemas
│   │   ├── services/
│   │   │   └── scraper.service.ts # Main Extraction Pipeline
│   │   └── validators/
│   │       └── profile.validator.ts # Zod validation schema
├── .env.local                     # Environment variables (git-ignored)
└── package.json                   # Dependencies
```

---

## 🔧 Development Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server on port 3000 |
| `npm run build` | Compile the application for production |
| `npm run start` | Run the compiled production server |
| `npm run lint` | Run ESLint checks |

---

## 🔐 Cookie Setup Guide

To bypass LinkedIn's authwall, you must provide valid cookies from a logged-in LinkedIn session. 
You can put these in your `.env.local`, or inject them dynamically via the Dashboard's **Settings (⚙️)** menu.

| Field | Where to find it |
|---|---|
| **li_at** | Open LinkedIn ➔ DevTools (F12) ➔ Application ➔ Cookies ➔ `li_at` |
| **JSESSIONID** | Open LinkedIn ➔ DevTools (F12) ➔ Application ➔ Cookies ➔ `JSESSIONID` (Include quotes if they exist, e.g., `"ajax:123..."`) |
| **User-Agent** | Just type "my user agent" in Google to copy yours. |

---

## 🤝 Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.
1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [Kritiman Talukdar](https://github.com/Kritiman2005)

Built with ❤️ for resilient data extraction.
