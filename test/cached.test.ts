import { describe, expect, it, vi } from 'vitest';
import { withCache } from '../src/providers/cached.js';
import type { OrganicResult, SerpProvider } from '../src/types.js';

const result: OrganicResult[] = [{ position: 1, title: 'T', url: 'https://t.cz/', snippet: '' }];

function setup(maxEntries = 10) {
  let time = 0;
  const search = vi.fn<SerpProvider['search']>().mockResolvedValue(result);
  const cached = withCache({ search }, { ttlMs: 1000, maxEntries, now: () => time });
  return { search, cached, advance: (ms: number) => (time += ms) };
}

describe('withCache', () => {
  it('opakovaný dopyt (bez ohľadu na veľkosť písmen) volá provider len raz', async () => {
    const { search, cached } = setup();
    await cached.search('Kávovar');
    await expect(cached.search('kávovar')).resolves.toBe(result);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('po uplynutí TTL sa dopyt zopakuje', async () => {
    const { search, cached, advance } = setup();
    await cached.search('a');
    advance(1001);
    await cached.search('a');
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('chybu necachuje', async () => {
    const { search, cached } = setup();
    search.mockRejectedValueOnce(new Error('boom'));
    await expect(cached.search('a')).rejects.toThrow('boom');
    await expect(cached.search('a')).resolves.toBe(result);
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('vyhodí najdlhšie nepoužitú položku pri prekročení limitu', async () => {
    const { search, cached } = setup(2);
    await cached.search('a');
    await cached.search('b');
    await cached.search('a'); // „a“ je teraz najnovšie
    await cached.search('c'); // vyhodí „b“
    await cached.search('a');
    expect(search).toHaveBeenCalledTimes(3);
    await cached.search('b');
    expect(search).toHaveBeenCalledTimes(4);
  });
});
