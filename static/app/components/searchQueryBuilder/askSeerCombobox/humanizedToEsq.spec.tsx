import {formatQueryToNaturalLanguage} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';

import {humanizedToEsq} from './humanizedToEsq';

// A realistic key predicate. In production this is backed by the
// SearchQueryBuilder `filterKeys`.
const KNOWN_KEYS = new Set([
  'is',
  'assigned',
  'level',
  'browser',
  'browser.name',
  'event.type',
  'error.type',
  'responsible_api_endpoint',
  'count()',
  'transaction.duration',
  'has',
  'release',
]);
const isKey = (key: string) => KNOWN_KEYS.has(key);

describe('humanizedToEsq', () => {
  describe("the user's canonical examples", () => {
    it('inverts the toy example', () => {
      expect(humanizedToEsq('is unresolved assigned is me', isKey)).toBe(
        'is:unresolved assigned:me'
      );
    });

    it('inverts the rich example with OR/AND and trailing free text', () => {
      const input =
        'event.type is error, error.type is ApiError, ' +
        'responsible_api_endpoint is getPluginForRender OR ' +
        'responsible_api_endpoint is GetPluginForRender AND code';
      expect(humanizedToEsq(input, isKey)).toBe(
        'event.type:error error.type:ApiError ' +
          'responsible_api_endpoint:getPluginForRender OR ' +
          'responsible_api_endpoint:GetPluginForRender AND code'
      );
    });
  });

  describe('is-as-key special case', () => {
    it('inverts a bare is: value', () => {
      expect(humanizedToEsq('is unresolved', isKey)).toBe('is:unresolved');
    });

    it('inverts a negated is: value', () => {
      expect(humanizedToEsq('is not resolved', isKey)).toBe('!is:resolved');
    });

    it('converts a clause-leading is even for values it cannot verify', () => {
      // We can't enumerate valid statuses, so a clause-leading `is <value>`
      // converts and the backend validates. (Prose like "the build is broken"
      // is guarded by clause position, not by the value — see below.)
      expect(humanizedToEsq('is broken', isKey)).toBe('is:broken');
    });
  });

  describe('operators', () => {
    it.each([
      ['count() is greater than 100', 'count():>100'],
      ['count() is less than 100', 'count():<100'],
      ['count() is greater than or equal to 100', 'count():>=100'],
      ['count() is less than or equal to 100', 'count():<=100'],
      ['browser is not chrome', '!browser:chrome'],
      ['count() is not greater than 2', '!count():>2'],
    ])('inverts "%s" → "%s"', (humanized, esq) => {
      expect(humanizedToEsq(humanized, isKey)).toBe(esq);
    });
  });

  describe('mixed free text and filters', () => {
    it('keeps free text before a filter', () => {
      expect(humanizedToEsq('hello event.type is error', isKey)).toBe(
        'hello event.type:error'
      );
    });

    it('keeps trailing free text after a filter', () => {
      expect(humanizedToEsq('is unresolved something', isKey)).toBe(
        'is:unresolved something'
      );
    });

    it('preserves quoted values with spaces', () => {
      expect(humanizedToEsq('release is "a big release"', isKey)).toBe(
        'release:"a big release"'
      );
    });
  });

  describe('declines (returns null) when it cannot cleanly invert', () => {
    it('pure free text', () => {
      expect(humanizedToEsq('database connection timeout', isKey)).toBeNull();
    });

    it('genuine natural language', () => {
      expect(
        humanizedToEsq('show me the errors that spiked yesterday', isKey)
      ).toBeNull();
    });

    it('does not invent a filter from an unknown key', () => {
      // `build` is not a real key → left as free text → no filters → null.
      expect(humanizedToEsq('the build is broken', isKey)).toBeNull();
    });
  });

  describe('round-trips formatQueryToNaturalLanguage (the function it inverts)', () => {
    it.each([
      'is:unresolved',
      'is:unresolved assigned:me',
      'browser:chrome',
      '!browser:chrome',
      'count():>100',
      'transaction.duration:>500',
      'event.type:error error.type:ApiError',
    ])('"%s" survives format → invert', esq => {
      const humanized = formatQueryToNaturalLanguage(esq);
      expect(humanizedToEsq(humanized, isKey)).toBe(esq);
    });
  });
});
