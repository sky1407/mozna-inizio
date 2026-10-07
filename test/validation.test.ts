import { describe, expect, it } from 'vitest';
import { MAX_QUERY_LENGTH, parseQuery } from '../src/validation.js';
import { ValidationError } from '../src/types.js';

describe('parseQuery', () => {
  it('orezáva a zlučuje medzery', () => {
    expect(parseQuery('  tvorba   webu \n brno ')).toBe('tvorba webu brno');
  });

  it.each([undefined, null, 42, ['a'], '', '   '])('odmietne neplatný vstup %j', (input) => {
    expect(() => parseQuery(input)).toThrow(ValidationError);
  });

  it('akceptuje maximálnu dĺžku a odmietne dlhší vstup', () => {
    expect(parseQuery('a'.repeat(MAX_QUERY_LENGTH))).toHaveLength(MAX_QUERY_LENGTH);
    expect(() => parseQuery('a'.repeat(MAX_QUERY_LENGTH + 1))).toThrow(ValidationError);
  });
});
