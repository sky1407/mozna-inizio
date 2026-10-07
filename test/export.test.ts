import { describe, expect, it } from 'vitest';
import { buildFilename, escapeCsvCell, toCsv, toJson } from '../src/export.js';
import type { SearchResult } from '../src/types.js';

const data: SearchResult = {
  query: 'kávovar',
  fetchedAt: '2026-10-07T12:00:00.000Z',
  results: [
    { position: 1, title: 'Kávovary, "akcia"', url: 'https://a.cz/', snippet: 'Riadok 1\nRiadok 2' },
    { position: 2, title: '=HYPERLINK("x")', url: 'https://b.cz/', snippet: 'Bez špeciálnych znakov' },
  ],
};

describe('toJson', () => {
  it('vráti platný JSON so zachovanou štruktúrou', () => {
    expect(JSON.parse(toJson(data))).toEqual(data);
  });
});

describe('toCsv', () => {
  it('obsahuje BOM, hlavičku a jeden riadok na výsledok', () => {
    const csv = toCsv(data);
    expect(csv.startsWith('﻿position,title,url,snippet\r\n')).toBe(true);
    expect(csv).toBe(
      '﻿position,title,url,snippet\r\n' +
        '1,"Kávovary, ""akcia""",https://a.cz/,"Riadok 1\nRiadok 2"\r\n' +
        `2,"'=HYPERLINK(""x"")",https://b.cz/,Bez špeciálnych znakov\r\n`,
    );
  });

  it('pri prázdnych výsledkoch vráti len hlavičku', () => {
    expect(toCsv({ ...data, results: [] })).toBe('﻿position,title,url,snippet\r\n');
  });
});

describe('escapeCsvCell', () => {
  it.each([
    ['obyčajný text', 'obyčajný text'],
    ['a,b', '"a,b"'],
    ['+420 123', "'+420 123"],
    ['@SUM(A1)', "'@SUM(A1)"],
    [-5, '-5'],
  ])('%s → %s', (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });
});

describe('buildFilename', () => {
  it('odstráni diakritiku a nebezpečné znaky', () => {
    expect(buildFilename('Žltý kôň / ../etc', 'csv')).toBe('google-zlty-kon-etc.csv');
  });

  it('použije náhradný názov, keď zo vstupu nič neostane', () => {
    expect(buildFilename('日本語', 'json')).toBe('google-vysledky.json');
  });
});
