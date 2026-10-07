import { ValidationError } from './types.js';

export const MAX_QUERY_LENGTH = 200;

/**
 * Overí a normalizuje kľúčové slovo z requestu (trim, zlúčenie medzier).
 * @throws {ValidationError} ak vstup chýba, nie je reťazec alebo je príliš dlhý
 */
export function parseQuery(input: unknown): string {
  if (typeof input !== 'string') {
    throw new ValidationError('Zadajte kľúčové slovo.');
  }
  const query = input.replace(/\s+/g, ' ').trim();
  if (query.length === 0) {
    throw new ValidationError('Zadajte kľúčové slovo.');
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`Kľúčové slovo môže mať najviac ${MAX_QUERY_LENGTH} znakov.`);
  }
  return query;
}
