import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSerperProvider, mapSerperResponse } from '../src/providers/serper.js';
import { ProviderError } from '../src/types.js';

const fixture: unknown = JSON.parse(readFileSync(new URL('./fixtures/serper-response.json', import.meta.url), 'utf8'));

describe('mapSerperResponse', () => {
  it('vráti len platné organické výsledky s prečíslovanou pozíciou', () => {
    expect(mapSerperResponse(fixture)).toEqual([
      {
        position: 1,
        title: 'Tvorba webových stránek na míru | INIZIO',
        url: 'https://www.inizio.cz/tvorba-webovych-stranek/',
        snippet: 'Navrhneme a vytvoříme web, který prodává.',
      },
      { position: 2, title: 'Webnode – vytvořte si web zdarma', url: 'https://www.webnode.cz/', snippet: '' },
      {
        position: 3,
        title: 'Jak na tvorbu webu v roce 2026',
        url: 'https://blog.example.cz/tvorba-webu',
        snippet: 'Kompletní průvodce, krok za krokem.',
      },
    ]);
  });

  it('vráti prázdne pole, keď nie sú žiadne organické výsledky', () => {
    expect(mapSerperResponse({ searchParameters: {} })).toEqual([]);
  });

  it.each([null, 'text', { organic: 'nie-pole' }])('odmietne neplatnú odpoveď %j', (body) => {
    expect(() => mapSerperResponse(body)).toThrow(ProviderError);
  });
});

describe('createSerperProvider', () => {
  const okResponse = () => new Response(JSON.stringify(fixture), { status: 200 });

  it('pošle správny request a vráti namapované výsledky', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(okResponse());
    const provider = createSerperProvider({ apiKey: 'test-key', fetchFn });

    const results = await provider.search('tvorba webových stránek');

    expect(results).toHaveLength(3);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://google.serper.dev/search');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'X-API-KEY': 'test-key' });
    expect(JSON.parse(String(init?.body))).toEqual({ q: 'tvorba webových stránek', gl: 'cz', hl: 'cs', num: 10 });
  });

  it('pri HTTP chybe vyhodí ProviderError', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(createSerperProvider({ apiKey: 'x', fetchFn }).search('a')).rejects.toThrow('chybu 401');
  });

  it('pri sieťovej chybe a neplatnom JSON vyhodí ProviderError', async () => {
    const networkFail = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(createSerperProvider({ apiKey: 'x', fetchFn: networkFail }).search('a')).rejects.toThrow(ProviderError);

    const badJson = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(createSerperProvider({ apiKey: 'x', fetchFn: badJson }).search('a')).rejects.toThrow(ProviderError);
  });

  it('bez API kľúča odmietne vzniknúť', () => {
    expect(() => createSerperProvider({ apiKey: '' })).toThrow('SERPER_API_KEY');
  });
});
