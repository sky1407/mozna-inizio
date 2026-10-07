import express, { type ErrorRequestHandler, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { buildFilename, EXPORT_FORMATS, toCsv, toJson, type ExportFormat } from './export.js';
import { parseQuery } from './validation.js';
import { ProviderError, ValidationError, type SearchResult, type SerpProvider } from './types.js';

export interface AppOptions {
  provider: SerpProvider;
  /** Max. počet dopytov na IP za minútu (chráni kvótu API kľúča). */
  rateLimitPerMinute?: number;
  /** Počet proxy pred aplikáciou (Render = 1), aby rate limit videl skutočnú IP klienta. */
  trustProxy?: number;
  now?: () => Date;
}

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

const CONTENT_TYPES: Record<ExportFormat, string> = {
  json: 'application/json; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
};

function parseFormat(input: unknown): ExportFormat {
  if (typeof input === 'string' && (EXPORT_FORMATS as readonly string[]).includes(input)) {
    return input as ExportFormat;
  }
  throw new ValidationError(`Nepodporovaný formát. Povolené: ${EXPORT_FORMATS.join(', ')}.`);
}

export function createApp({ provider, rateLimitPerMinute = 30, trustProxy = 0, now = () => new Date() }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; frame-ancestors 'none'",
    });
    next();
  });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(express.static(PUBLIC_DIR));

  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: rateLimitPerMinute,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Príliš veľa dopytov, skúste to o chvíľu.' },
    }),
  );

  async function runSearch(req: Request): Promise<SearchResult> {
    const query = parseQuery(req.query['q']);
    const results = await provider.search(query);
    return { query, fetchedAt: now().toISOString(), results };
  }

  /** Náhľad výsledkov pre UI. */
  app.get('/api/search', async (req, res) => {
    res.set('Cache-Control', 'no-store').json(await runSearch(req));
  });

  /** Stiahnutie výsledkov ako súbor (JSON alebo CSV). */
  app.get('/api/export', async (req, res) => {
    const format = parseFormat(req.query['format'] ?? 'json');
    const data = await runSearch(req);
    res
      .set('Cache-Control', 'no-store')
      .type(CONTENT_TYPES[format])
      .attachment(buildFilename(data.query, format))
      .send(format === 'csv' ? toCsv(data) : toJson(data));
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Neznámy endpoint.' });
  });

  const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ProviderError) {
      console.error('[provider]', err.message, err.cause ?? '');
      res.status(502).json({ error: err.message });
      return;
    }
    console.error('[unhandled]', err);
    res.status(500).json({ error: 'Interná chyba servera.' });
  };
  app.use(errorHandler);

  return app;
}
