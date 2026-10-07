import { createApp } from './app.js';
import { withCache } from './providers/cached.js';
import { createSerperProvider } from './providers/serper.js';

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} musí byť nezáporné celé číslo.`);
  return value;
}

try {
  const provider = withCache(
    createSerperProvider({
      apiKey: process.env['SERPER_API_KEY'] ?? '',
      country: process.env['SEARCH_COUNTRY'] || 'cz',
      language: process.env['SEARCH_LANGUAGE'] || 'cs',
    }),
    { ttlMs: 10 * 60_000, maxEntries: 500 },
  );

  const app = createApp({
    provider,
    rateLimitPerMinute: readIntEnv('RATE_LIMIT_PER_MINUTE', 30),
    trustProxy: readIntEnv('TRUST_PROXY', 0),
    ...(process.env['CLIENT_IP_HEADER'] ? { clientIpHeader: process.env['CLIENT_IP_HEADER'] } : {}),
  });

  const port = readIntEnv('PORT', 3000);
  const server = app.listen(port, () => console.log(`Server beží na http://localhost:${port}`));

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (error) {
  console.error('Štart zlyhal:', error instanceof Error ? error.message : error);
  process.exit(1);
}
