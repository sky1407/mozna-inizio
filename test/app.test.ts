import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { ProviderError, type OrganicResult, type SerpProvider } from '../src/types.js';

const results: OrganicResult[] = [
  { position: 1, title: 'Kávovary | Alza', url: 'https://www.alza.cz/kavovary', snippet: 'Široký výběr, "akce".' },
  { position: 2, title: 'Kávovar – Wikipedie', url: 'https://cs.wikipedia.org/wiki/Kávovar', snippet: '' },
];

function setup(search: SerpProvider['search'] = async () => results, rateLimitPerMinute = 100) {
  const provider = { search: vi.fn(search) };
  const app = createApp({ provider, rateLimitPerMinute, now: () => new Date('2026-10-07T12:00:00Z') });
  return { app, provider };
}

describe('GET /api/search', () => {
  it('vráti dopyt, čas a organické výsledky', async () => {
    const { app, provider } = setup();
    const res = await request(app).get('/api/search').query({ q: '  kávovar ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ query: 'kávovar', fetchedAt: '2026-10-07T12:00:00.000Z', results });
    expect(provider.search).toHaveBeenCalledWith('kávovar');
  });

  it('bez kľúčového slova vráti 400 a provider nevolá', async () => {
    const { app, provider } = setup();
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(provider.search).not.toHaveBeenCalled();
  });

  it('pri chybe providera vráti 502 so správou', async () => {
    const { app } = setup(async () => {
      throw new ProviderError('Vyhľadávač neodpovedal včas.');
    });
    const res = await request(app).get('/api/search').query({ q: 'a' });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Vyhľadávač neodpovedal včas.' });
  });

  it('pri neočakávanej chybe neprezradí detaily', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app } = setup(async () => {
      throw new Error('tajný stack');
    });
    const res = await request(app).get('/api/search').query({ q: 'a' });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('tajný');
  });

  it('po prekročení limitu vráti 429', async () => {
    const { app } = setup(undefined, 1);
    await request(app).get('/api/search').query({ q: 'a' }).expect(200);
    await request(app).get('/api/search').query({ q: 'a' }).expect(429);
  });

  it('za proxy počíta limit podľa IP z nastavenej hlavičky', async () => {
    const app = createApp({ provider: { search: async () => results }, rateLimitPerMinute: 1, clientIpHeader: 'cf-connecting-ip' });
    const from = (ip: string) => request(app).get('/api/search').query({ q: 'a' }).set('CF-Connecting-IP', ip);
    await from('203.0.113.1').expect(200);
    await from('203.0.113.2').expect(200);
    await from('203.0.113.1').expect(429);
  });
});

describe('GET /api/export', () => {
  it('vráti CSV ako prílohu', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/export').query({ q: 'kávovar', format: 'csv' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe('attachment; filename="google-kavovar.csv"');
    const lines = res.text.replace(/^﻿/, '').trimEnd().split('\r\n');
    expect(lines).toEqual([
      'position,title,url,snippet',
      '1,Kávovary | Alza,https://www.alza.cz/kavovary,"Široký výběr, ""akce""."',
      '2,Kávovar – Wikipedie,https://cs.wikipedia.org/wiki/Kávovar,',
    ]);
  });

  it('predvolene vráti JSON ako prílohu', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/export').query({ q: 'kávovar' });

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="google-kavovar.json"');
    expect(JSON.parse(res.text)).toEqual({ query: 'kávovar', fetchedAt: '2026-10-07T12:00:00.000Z', results });
  });

  it('odmietne nepodporovaný formát', async () => {
    const { app, provider } = setup();
    const res = await request(app).get('/api/export').query({ q: 'a', format: 'xml' });
    expect(res.status).toBe(400);
    expect(provider.search).not.toHaveBeenCalled();
  });
});

describe('ostatné', () => {
  it('healthcheck a bezpečnostné hlavičky', async () => {
    const { app } = setup();
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('neznámy API endpoint vráti JSON 404', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/nic');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});
