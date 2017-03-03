import {getCurlCommand} from 'app/components/events/interfaces/utils';


describe('components/interfaces/utils', function() {
  describe('getCurlCommand()', function() {
    it('should convert an http request object to an equivalent unix curl command string', function () {
      getCurlCommand({
        'cookies': [
          [
            'foo',
            'bar'
          ],
          [
            'biz',
            'baz'
          ]
        ],
        'url': 'http://example.com/foo',
        'headers': [
          [
            'Referer',
            'http://example.com'
          ],
          [
            'User-Agent',
            'Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36'
          ],
          [
            'Content-Type',
            'application/json'
          ],
        ],
        'env': {
          'ENV': 'prod'
        },
        'fragment': '',
        'query': 'foo=bar',
        'data': '{"hello": "world"}',
        'method': 'GET'
      }).should.eql('curl \\\n' +
        ' -H "Content-Type: application/json" \\\n' +
        ' -H "Referer: http://example.com" \\\n' +
        ' -H "User-Agent: Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36" \\\n' +
        ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
        ' "http://example.com/foo?foo=bar"'
      );

      // --compressed (because Accept-Encoding: gzip)
      getCurlCommand({
        'url': 'http://example.com/foo',
        'headers': [
          [
            'Content-Type',
            'application/json'
          ],
          [
            'Referer',
            'http://example.com'
          ],
          [
            'Accept-Encoding',
            'gzip'
          ]
        ],
        'env': {
          'ENV': 'prod'
        },
        'fragment': '',
        'query': 'foo=bar',
        'data': '{"hello": "world"}',
        'method': 'GET'
      }).should.eql('curl \\\n' +
        ' --compressed \\\n' +
        ' -H "Accept-Encoding: gzip" \\\n' +
        ' -H "Content-Type: application/json" \\\n' +
        ' -H "Referer: http://example.com" \\\n' +
        ' --data "{\\"hello\\": \\"world\\"}" \\\n' +
        ' "http://example.com/foo?foo=bar"'
      );
    });
  });
});

