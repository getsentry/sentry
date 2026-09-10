import {EventFixture} from 'sentry-fixture/event';

import {
  getCurlCommand,
  getCurrentThread,
  getThreadById,
  stringifyQueryList,
  userContextToActor,
} from 'sentry/components/events/interfaces/utils';
import {FILTER_MASK} from 'sentry/constants';
import {EntryType} from 'sentry/types/event';

describe('components/interfaces/utils', () => {
  describe('getCurlCommand()', () => {
    it('should convert an http request object to an equivalent unix curl command string', () => {
      expect(
        getCurlCommand({
          apiTarget: null,
          cookies: [
            ['foo', 'bar'],
            ['biz', 'baz'],
          ],
          url: 'http://example.com/foo',
          headers: [
            ['Referer', 'http://example.com'],
            [
              'User-Agent',
              'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36',
            ],
            ['Content-Type', 'application/json'],
          ],
          env: {
            ENV: 'prod',
          },
          fragment: '',
          query: [['foo', 'bar']],
          data: '{"hello": "world"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' -H "User-Agent: Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36" \\\n' +
          ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
          ' "http://example.com/foo?foo=bar"'
      );

      // --compressed (because Accept-Encoding: gzip)
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo',
          headers: [
            ['Content-Type', 'application/json'],
            ['Referer', 'http://example.com'],
            ['Accept-Encoding', 'gzip'],
          ],
          env: {
            ENV: 'prod',
          },
          fragment: '',
          query: [['foo', 'bar']],
          data: '{"hello": "world"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' --compressed \\\n' +
          ' -H "Accept-Encoding: gzip" \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
          ' "http://example.com/foo?foo=bar"'
      );

      // Do not add `data` if `data` is missing
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo',
          headers: [],
          env: {
            ENV: 'prod',
          },
          fragment: '',
          query: [['foo', 'bar']],
          method: 'GET',
        })
      ).toBe('curl \\\n "http://example.com/foo?foo=bar"');

      // Do not add `data` if `data` is empty object
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo',
          headers: [],
          env: {
            ENV: 'prod',
          },
          inferredContentType: null,
          fragment: '',
          data: {},
          method: 'GET',
        })
      ).toBe('curl \\\n "http://example.com/foo"');

      // Filter out undefined headers
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo',
          headers: [
            ['Referer', 'http://example.com'],
            ['Content-Type', 'application/json'],
            undefined as any,
          ],
          data: '{"hello": "world"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
          ' "http://example.com/foo"'
      );

      // Filter out null headers
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo',
          headers: [
            ['Referer', 'http://example.com'],
            ['Content-Type', 'application/json'],
            null as any,
          ],
          data: '{"hello": "world"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
          ' "http://example.com/foo"'
      );

      // Escape escaped strings.
      expect(
        getCurlCommand({
          apiTarget: null,
          cookies: [
            ['foo', 'bar'],
            ['biz', 'baz'],
          ],
          url: 'http://example.com/foo',
          headers: [
            ['Referer', 'http://example.com'],
            [
              'User-Agent',
              'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36',
            ],
            ['Content-Type', 'application/json'],
          ],
          env: {
            ENV: 'prod',
          },
          fragment: '',
          query: [],
          data: '{"a":"b\\"c"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' -H "User-Agent: Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36" \\\n' +
          ' --data "{\\"a\\":\\"b\\\\\\"c\\"}" \\\n' +
          ' "http://example.com/foo"'
      );

      // Escape strings with special bash characters
      expect(
        getCurlCommand({
          apiTarget: null,
          url: 'http://example.com/foo${not_a_variable}',
          headers: [
            ['Referer', 'http://example.com'],
            [
              'User-Agent',
              'Mozilla/5.0 ("Windows" NT 6.2; WOW64) $not_a_variable `test`',
            ],
            ['Content-Type', 'application/json'],
          ],
          fragment: '',
          query: [],
          data: '{"a$TEST":"b\\"c"}',
          method: 'GET',
        })
      ).toEqual(
        'curl \\\n' +
          ' -H "Content-Type: application/json" \\\n' +
          ' -H "Referer: http://example.com" \\\n' +
          ' -H "User-Agent: Mozilla/5.0 (\\"Windows\\" NT 6.2; WOW64) \\$not_a_variable \\`test\\`" \\\n' +
          ' --data "{\\"a\\$TEST\\":\\"b\\\\\\"c\\"}" \\\n' +
          ' "http://example.com/foo\\${not_a_variable}"'
      );
    });
  });

  describe('removeFilterMaskedEntries()', () => {
    const rawData = {
      id: '26',
      name: FILTER_MASK,
      username: 'maiseythedog',
      email: FILTER_MASK,
    };
    it('should remove filtered values', () => {
      const result = userContextToActor(rawData);
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('email');
    });
    it('should remove boolean values', () => {
      const result = userContextToActor({
        ...rawData,
        name: true,
        email: false,
      });
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('email');
    });
    it('should preserve unfiltered values', () => {
      const result = userContextToActor(rawData);
      expect(result).toHaveProperty('id');
      expect(result.id).toBe('26');
      expect(result).toHaveProperty('username');
      expect(result.username).toBe('maiseythedog');
    });
  });

  describe('stringifyQueryList()', () => {
    it('should return query if it is a string', () => {
      const query = stringifyQueryList('query');
      expect(query).toBe('query');
    });
    it('should parse query tuples', () => {
      const query = stringifyQueryList([
        ['field', 'ops.http'],
        ['field', 'ops.db'],
        ['field', 'total.time'],
        ['numBuckets', '100'],
      ]);
      expect(query).toBe('field=ops.http&field=ops.db&field=total.time&numBuckets=100');
    });
  });

  describe('getCurrentThread()', () => {
    it('should return current thread if available', () => {
      const thread = getCurrentThread(
        EventFixture({
          entries: [
            {
              data: {
                values: [
                  {
                    id: 13920,
                    current: true,
                    crashed: true,
                    name: 'puma 002',
                    stacktrace: null,
                    rawStacktrace: null,
                    state: 'WAITING',
                  },
                ],
              },
              type: EntryType.THREADS,
            },
          ],
        })
      );
      expect(thread?.name).toBe('puma 002');
    });
  });

  describe('getThreadById()', () => {
    it('should return thread by given id if available', () => {
      const thread = getThreadById(
        EventFixture({
          entries: [
            {
              data: {
                values: [
                  {
                    id: 13920,
                    current: true,
                    crashed: true,
                    name: 'puma 002',
                    stacktrace: null,
                    rawStacktrace: null,
                    state: 'WAITING',
                  },
                ],
              },
              type: EntryType.THREADS,
            },
          ],
        }),
        13920
      );
      expect(thread?.name).toBe('puma 002');
    });
  });
});
