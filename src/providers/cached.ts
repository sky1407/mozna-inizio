import type { OrganicResult, SerpProvider } from '../types.js';

export interface CacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

/**
 * Obalí provider in-memory LRU cache s TTL. Šetrí kvótu API (náhľad + stiahnutie
 * súboru = jeden dopyt) a zlučuje súbežné rovnaké dopyty do jedného requestu.
 * Chybné odpovede sa necachujú.
 */
export function withCache(provider: SerpProvider, { ttlMs, maxEntries, now = Date.now }: CacheOptions): SerpProvider {
  const cache = new Map<string, { expiresAt: number; value: Promise<OrganicResult[]> }>();

  return {
    search(query) {
      const key = query.toLocaleLowerCase('cs');
      const hit = cache.get(key);
      if (hit && hit.expiresAt > now()) {
        cache.delete(key);
        cache.set(key, hit); // presun na koniec = naposledy použitý
        return hit.value;
      }

      const value = provider.search(query);
      cache.set(key, { expiresAt: now() + ttlMs, value });
      value.catch(() => {
        if (cache.get(key)?.value === value) cache.delete(key);
      });

      while (cache.size > maxEntries) {
        const oldest = cache.keys().next().value;
        if (oldest === undefined) break;
        cache.delete(oldest);
      }
      return value;
    },
  };
}
