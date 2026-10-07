import { ProviderError, type OrganicResult, type SerpProvider } from '../types.js';

const SERPER_URL = 'https://google.serper.dev/search';

export interface SerperOptions {
  apiKey: string;
  /** Krajina výsledkov (Google `gl`). */
  country?: string;
  /** Jazyk rozhrania (Google `hl`). */
  language?: string;
  timeoutMs?: number;
  /** Injektovateľný fetch kvôli testom. */
  fetchFn?: typeof fetch;
}

/**
 * Prevedie surovú odpoveď Serper.dev na organické výsledky.
 * Ignoruje reklamy, knowledge graph, PAA atď. – berie len pole `organic`
 * a zahodí položky bez platnej http(s) URL alebo titulku.
 */
export function mapSerperResponse(body: unknown): OrganicResult[] {
  if (typeof body !== 'object' || body === null) {
    throw new ProviderError('Neplatná odpoveď vyhľadávača.');
  }
  const organic = (body as { organic?: unknown }).organic;
  if (organic === undefined) return [];
  if (!Array.isArray(organic)) {
    throw new ProviderError('Neplatná odpoveď vyhľadávača.');
  }

  const results: OrganicResult[] = [];
  for (const item of organic) {
    if (typeof item !== 'object' || item === null) continue;
    const { title, link, snippet } = item as Record<string, unknown>;
    if (typeof title !== 'string' || title.trim() === '' || !isHttpUrl(link)) continue;
    results.push({
      position: results.length + 1,
      title: title.trim(),
      url: link,
      snippet: typeof snippet === 'string' ? snippet.trim() : '',
    });
  }
  return results;
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Provider nad Serper.dev (Google SERP API), vracia organické výsledky z 1. strany. */
export function createSerperProvider(options: SerperOptions): SerpProvider {
  const { apiKey, country = 'cz', language = 'cs', timeoutMs = 10_000, fetchFn = fetch } = options;
  if (!apiKey) throw new Error('Chýba SERPER_API_KEY.');

  return {
    async search(query) {
      let response: Response;
      try {
        response = await fetchFn(SERPER_URL, {
          method: 'POST',
          headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: query, gl: country, hl: language, num: 10 }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error && error.name === 'TimeoutError' ? 'neodpovedal včas' : 'je nedostupný';
        throw new ProviderError(`Vyhľadávač ${reason}.`, { cause: error });
      }

      if (!response.ok) {
        throw new ProviderError(`Vyhľadávač vrátil chybu ${response.status}.`);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        throw new ProviderError('Neplatná odpoveď vyhľadávača.', { cause: error });
      }
      return mapSerperResponse(body);
    },
  };
}
