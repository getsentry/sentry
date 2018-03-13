import {
  getCurlCommand,
  objectToSortedTupleArray,
} from 'app/components/events/interfaces/utils';

describe('components/interfaces/utils', function() {
  describe('getCurlCommand()', function() {
    it('should convert an http request object to an equivalent unix curl command string', function() {
      expect(
        getCurlCommand({
          cookies: [['foo', 'bar'], ['biz', 'baz']],
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
          query: 'foo=bar',
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
          query: 'foo=bar',
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
          query: 'foo=bar',
          method: 'GET',
        })
      ).toEqual('curl \\\n "http://example.com/foo?foo=bar"');
    });
  });

  describe('objectToSortedTupleArray()', function() {
    it('should convert a key/value object to a sorted array of key/value tuples', function() {
      // expect(
      //   objectToSortedTupleArray({
      //     awe: 'some',
      //     foo: 'bar',
      //     bar: 'baz'
      //   })
      // ).toEqual([
      //   // note sorted alphabetically by key
      //   ['awe', 'some'],
      //   ['bar', 'baz'],
      //   ['foo', 'bar']
      // ]);

      expect(
        objectToSortedTupleArray({
          foo: ['bar', 'baz'],
        })
      ).toEqual([['foo', 'bar'], ['foo', 'baz']]);

      // expect(
      //   objectToSortedTupleArray({
      //     foo: ''
      //   })
      // ).toEqual([['foo', '']]);
    });
  });
});
