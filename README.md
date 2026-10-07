# Google SERP export – praktický test mozna.inizio.cz

HTML stránka s jedným inputom: zadáte kľúčové slovo a dostanete organické výsledky
z 1. strany Google, ktoré si stiahnete ako **JSON** alebo **CSV**.

## Architektúra

```
public/            statická stránka (HTML + vanilla JS, prísna CSP)
src/
  app.ts           Express: /api/search (náhľad), /api/export (súbor), /healthz
  server.ts        štart, konfigurácia z env
  validation.ts    validácia a normalizácia kľúčového slova
  export.ts        serializácia do JSON / CSV (RFC 4180, ochrana proti CSV injection)
  providers/
    serper.ts      Google SERP cez Serper.dev – berie len organické výsledky
    cached.ts      LRU cache s TTL (šetrí kvótu API, zlučuje súbežné dopyty)
test/              Vitest + supertest, fixture odpovede – testy nevolajú sieť
```

**Prečo SERP API a nie priamy scraping:** Google z IP adries cloudových hostingov
spoľahlivo vracia CAPTCHA/429 a jeho HTML sa často mení. Zdroj dát je za rozhraním
`SerpProvider`, takže ho je možné vymeniť (napr. za vlastný scraper) bez zásahu do zvyšku aplikácie.

## API

| Endpoint | Popis |
|---|---|
| `GET /api/search?q=…` | JSON `{ query, fetchedAt, results[] }` pre náhľad |
| `GET /api/export?q=…&format=json\|csv` | rovnaké dáta ako súbor na stiahnutie |

Výsledok: `{ position, title, url, snippet }`. Chyby vracajú `{ error }` so stavom 400 / 429 / 502.

## Spustenie

```bash
cp .env.example .env        # doplňte SERPER_API_KEY (https://serper.dev)
npm install
npm run dev                 # http://localhost:3000
npm test                    # unit + integračné testy
```

Docker (lokálny vývoj s hot-reloadom):

```bash
docker compose up
```

## Nasadenie (Render)

Repozitár obsahuje `render.yaml` → *New → Blueprint*, doplniť `SERPER_API_KEY`.
Render buduje produkčný stage z `Dockerfile` (beží ako neprivilegovaný používateľ).
