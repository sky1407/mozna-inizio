# Google SERP export – mozna.inizio.cz practical test

A single-input HTML page: enter a keyword and get the organic results from the first page of Google,
downloadable as **JSON** or **CSV**.

**Live demo:** <https://mozna-inizio.onrender.com> (Render free plan – the first request after a period of inactivity
takes a few seconds to wake the service up). Slovak version: [README.sk.md](README.sk.md).

## Architecture

```
public/            static page (HTML + vanilla JS, strict CSP)
src/
  app.ts           Express: /api/search (preview), /api/export (file), /healthz
  server.ts        startup, configuration from env
  validation.ts    keyword validation and normalisation
  export.ts        JSON / CSV serialisation (RFC 4180, CSV injection protection)
  providers/
    serper.ts      Google SERP via Serper.dev – keeps organic results only
    cached.ts      LRU cache with TTL (saves API quota, merges concurrent requests)
test/              Vitest + supertest with fixture responses – tests never hit the network
```

**Why a SERP API instead of scraping Google directly:** from cloud hosting IP addresses Google reliably answers with
CAPTCHA/429, and its HTML changes often. The data source sits behind the `SerpProvider` interface, so it can be swapped
(for example for a custom scraper) without touching the rest of the application.

## API

| Endpoint | Description |
|---|---|
| `GET /api/search?q=…` | JSON `{ query, fetchedAt, results[] }` for the preview |
| `GET /api/export?q=…&format=json\|csv` | the same data as a downloadable file |

Each result: `{ position, title, url, snippet }`. Errors return `{ error }` with status 400 / 429 / 502.

## Running locally

```bash
cp .env.example .env        # fill in SERPER_API_KEY (https://serper.dev)
npm install
npm run dev                 # http://localhost:3000
npm test                    # unit + integration tests
```

Docker (local development with hot reload):

```bash
docker compose up
```

## Deployment (Render)

The repository contains `render.yaml` → *New → Blueprint*, then add `SERPER_API_KEY`.
Render builds the production stage of the `Dockerfile` (runs as an unprivileged user).
