import {MetaProxy, withMeta} from 'app/components/events/meta/metaProxy';
import {
  getCurlCommand,
  objectToSortedTupleArray,
  removeFilterMaskedEntries,
} from 'app/components/events/interfaces/utils';
import {FILTER_MASK} from 'app/constants';

describe('components/interfaces/utils', function () {
  describe('getCurlCommand()', function () {
    it('should convert an http request object to an equivalent unix curl command string', function () {
      expect(
        getCurlCommand({
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

      // Do not add data if data is empty
      expect(
        getCurlCommand({
          url: 'http://example.com/foo',
          headers: [],
          env: {
            ENV: 'prod',
          },
          fragment: '',
          query: [['foo', 'bar']],
          method: 'GET',
        })
      ).toEqual('curl \\\n "http://example.com/foo?foo=bar"');

      // Do not add data if data is empty object
      expect(
        getCurlCommand({
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
      ).toEqual('curl \\\n "http://example.com/foo"');

      // Escape escaped strings.
      expect(
        getCurlCommand({
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
    });

    it('works with a Proxy', function () {
      const spy = jest.spyOn(MetaProxy.prototype, 'get');
      const data = {
        fragment: '',
        cookies: [],
        inferredContentType: null,
        env: {
          SERVER_NAME: 'sentry',
          SERVER_PORT: '443',
          REMOTE_ADDR: '127.0.0.1',
        },
        headers: [
          ['Accept-Language', 'en'],
          ['Referer', 'http://example.com'],
          [
            'User-Agent',
            'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36',
          ],
          ['Content-Type', 'application/json'],
          ['Referer', 'http://example.com'],
          ['Accept-Encoding', 'gzip'],
        ],
        url: 'https://www.sentry.io',
        query: [],
        data: null,
        method: 'GET',
      };
      const eventWithProxy = withMeta(data);
      getCurlCommand(eventWithProxy);

      // This may need to change, but we should aim to keep this low
      expect(spy.mock.calls.length).toBeLessThan(200);
    });
  });

  describe('objectToSortedTupleArray()', function () {
    it('should convert a key/value object to a sorted array of key/value tuples', function () {
      expect(
        objectToSortedTupleArray({
          foo: ['bar', 'baz'],
        })
      ).toEqual([
        ['foo', 'bar'],
        ['foo', 'baz'],
      ]);
    });
  });

  describe('removeFilterMaskedEntries()', function () {
    const rawData = {
      id: '26',
      name: FILTER_MASK,
      username: 'maiseythedog',
      email: FILTER_MASK,
    };
    it('should remove filtered values', function () {
      const result = removeFilterMaskedEntries(rawData);
      expect(result).not.toHaveProperty('name');
      expect(result).not.toHaveProperty('email');
    });
    it('should preserve unfiltered values', function () {
      const result = removeFilterMaskedEntries(rawData);
      expect(result).toHaveProperty('id');
      expect(result.id).toEqual('26');
      expect(result).toHaveProperty('username');
      expect(result.username).toEqual('maiseythedog');
    });
  });
});
