import {
  parseQueryKey,
  safeParseQueryKey,
  type ApiQueryKey,
  type InfiniteApiQueryKey,
} from './apiQueryKey';
import {getApiUrl} from './getApiUrl';

describe('apiQueryKey', () => {
  it.each<{baseKey: ApiQueryKey | InfiniteApiQueryKey}>([
    {baseKey: [getApiUrl('/api-tokens/'), {}, {infinite: false}]},
    {baseKey: [getApiUrl('/api-tokens/'), {}, {infinite: true}]},
  ])('parses trailing metadata after the required API key fields (%#)', ({baseKey}) => {
    const queryKey = [...baseKey, {sessionKey: 'session'}, 'revision'] as const;
    const expected = {
      url: '/api-tokens/',
      options: {},
      isInfinite: baseKey[2].infinite,
    };

    expect(parseQueryKey(queryKey)).toEqual(expected);
    expect(safeParseQueryKey(queryKey)).toEqual(expected);
  });

  describe('parseQueryKey', () => {
    it('parses a canonical non-infinite key', () => {
      const queryKey: ApiQueryKey = [
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
        {infinite: false},
      ];
      expect(parseQueryKey(queryKey)).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('parses a´n infinite key', () => {
      const queryKey: InfiniteApiQueryKey = [
        getApiUrl('/api-tokens/'),
        {query: {filter: 'red'}},
        {infinite: true},
      ];
      expect(parseQueryKey(queryKey)).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });
  });

  describe('safeParseQueryKey', () => {
    it('parses canonical non-infinite', () => {
      expect(
        safeParseQueryKey(['/api-tokens/', {query: {filter: 'red'}}, {infinite: false}])
      ).toEqual({
        isInfinite: false,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    it('parses canonical infinite', () => {
      expect(
        safeParseQueryKey(['/api-tokens/', {query: {filter: 'red'}}, {infinite: true}])
      ).toEqual({
        isInfinite: true,
        url: '/api-tokens/',
        options: {query: {filter: 'red'}},
      });
    });

    describe('rejection', () => {
      it('returns undefined for an empty array', () => {
        expect(safeParseQueryKey([])).toBeUndefined();
      });

      it('returns undefined when the first element is a number', () => {
        expect(safeParseQueryKey([123])).toBeUndefined();
      });

      it('returns undefined when the first element is null', () => {
        expect(safeParseQueryKey([null])).toBeUndefined();
      });

      it('returns undefined when the first element is not a string', () => {
        expect(safeParseQueryKey([123, {}, {infinite: false}])).toBeUndefined();
      });

      it('returns undefined when the second element is not an object', () => {
        expect(safeParseQueryKey(['/url/', 'not-an-object'])).toBeUndefined();
      });

      it('returns undefined when the third element is not a marker', () => {
        expect(safeParseQueryKey(['/url/', {query: {}}, 'not-a-marker'])).toBeUndefined();
      });

      it('returns undefined when the marker is missing the infinite field', () => {
        expect(safeParseQueryKey(['/url/', {query: {}}, {}])).toBeUndefined();
      });
    });

    it('returns undefined for a [string, object] tuple missing the marker', () => {
      expect(safeParseQueryKey(['filter', {scope: 'feedback'}])).toBeUndefined();
    });
  });
});
