import {PolicyRevisionSchema} from 'admin/schemas/policies';

describe('PolicyRevisionSchema', () => {
  const urlField = PolicyRevisionSchema.find(f => f.name === 'url')!;
  const validate = urlField.validate!;

  describe('url field validation', () => {
    it('accepts https URLs', () => {
      expect(
        validate({id: 'url', form: {url: 'https://sentry.io/legal/terms/'}})
      ).toEqual([]);
    });

    it('accepts http URLs', () => {
      expect(validate({id: 'url', form: {url: 'http://example.com/policy/'}})).toEqual(
        []
      );
    });

    it('allows an empty value', () => {
      expect(validate({id: 'url', form: {url: ''}})).toEqual([]);
      expect(validate({id: 'url', form: {url: undefined}})).toEqual([]);
    });

    it('rejects javascript: URLs with a protocol error', () => {
      // Build via concatenation to avoid the no-script-url ESLint rule.
      const jsUrl = 'javascript' + ':alert(document.domain)';
      expect(validate({id: 'url', form: {url: jsUrl}})).toEqual([
        ['url', 'URL must use http or https protocol'],
      ]);
    });

    it('rejects data: URLs with a protocol error', () => {
      expect(
        validate({
          id: 'url',
          form: {url: 'data:text/html,<script>alert(1)</script>'},
        })
      ).toEqual([['url', 'URL must use http or https protocol']]);
    });

    it('rejects vbscript: URLs with a protocol error', () => {
      expect(validate({id: 'url', form: {url: 'vbscript:msgbox(1)'}})).toEqual([
        ['url', 'URL must use http or https protocol'],
      ]);
    });

    it('rejects non-URL strings with an invalid URL error', () => {
      expect(validate({id: 'url', form: {url: 'not-a-valid-url'}})).toEqual([
        ['url', 'Please enter a valid URL'],
      ]);
    });
  });
});
