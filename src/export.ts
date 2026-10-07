import type { SearchResult } from './types.js';

export type ExportFormat = 'json' | 'csv';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['json', 'csv'];

const CSV_COLUMNS = ['position', 'title', 'url', 'snippet'] as const;

export function toJson(data: SearchResult): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Escapuje hodnotu podľa RFC 4180 a neutralizuje CSV/formula injection
 * (bunky začínajúce `= + - @` by Excel vyhodnotil ako vzorec).
 */
export function escapeCsvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV s hlavičkou, CRLF riadkami a UTF-8 BOM (kvôli diakritike v Exceli). */
export function toCsv(data: SearchResult): string {
  const rows = data.results.map((r) => CSV_COLUMNS.map((col) => escapeCsvCell(r[col])).join(','));
  return '﻿' + [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Bezpečný názov súboru z kľúčového slova (len ASCII, bez diakritiky). */
export function buildFilename(query: string, format: ExportFormat): string {
  const slug = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `google-${slug || 'vysledky'}.${format}`;
}
