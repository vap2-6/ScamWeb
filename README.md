# Scam & Illegal-Sale Ad Detector

AI pipeline that flags scam / illegal-goods ads (Instagram-style), extracts
links + payment info, cross-checks them against threat intel, and generates
a structured evidence report.

## Scope (2-day hackathon build)

**Core (build first, this is the demo):**
- Static/sample dataset of ad captions + OCR'd image text (`backend/src/data/sample_posts.json`)
- LLM classifier (scam category, risk score, red flags, extracted links/payment info)
- Google Safe Browsing check on extracted URLs
- Dashboard: list posts → view analysis → generate report
- Report formatter (JSON export, human-readable summary)

**Optional / stretch (only if time remains):**
- `services/scraper.js` — live Instagram fetch (stubbed, disabled by default)
- `services/whois.js` — domain-age lookup (stubbed, disabled by default)

**Explicitly out of scope:**
- Identifying/doxxing the real-world seller. This tool compiles evidence
  for cybercrime authorities — attribution is their job, not ours.

## Stack (all free tier)
- Backend: Node.js + Express
- Classifier: Google Gemini API (`gemini-1.5-flash`, free tier) — swap in
  Claude API if you have credits
- Threat intel: Google Safe Browsing API (free)
- Frontend: plain HTML/CSS/JS, no build step (fastest to demo/debug)

## Setup

```bash
cd backend
cp .env.example .env   # fill in your free API keys
npm install
npm run dev             # starts on http://localhost:3001
```

Then open `frontend/index.html` directly in a browser (or `npx serve frontend`).

## Getting free API keys
- Gemini: https://aistudio.google.com/app/apikey (free tier, generous limits)
- Safe Browsing: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
  (enable API, create API key — free)

## Repo structure
```
scam-detector/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express app entrypoint
│   │   ├── routes/
│   │   │   ├── analyze.js        # POST /api/analyze
│   │   │   └── reports.js        # GET/POST /api/reports
│   │   ├── services/
│   │   │   ├── classifier.js     # LLM call -> scam classification JSON
│   │   │   ├── linkExtractor.js  # regex extraction (backup to LLM output)
│   │   │   ├── safeBrowsing.js   # Google Safe Browsing lookup
│   │   │   ├── whois.js          # [OPTIONAL] domain age lookup, stubbed
│   │   │   └── scraper.js        # [OPTIONAL] live IG fetch, stubbed
│   │   ├── data/
│   │   │   └── sample_posts.json # your 15-20 collected sample ads
│   │   └── utils/
│   │       └── reportFormatter.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
└── docs/
    └── classifier_prompt.md
```

## Team split
- **Dev 1**: classifier.js, safeBrowsing.js, sample dataset collection
- **Dev 2**: Express routes, frontend dashboard, report formatter
