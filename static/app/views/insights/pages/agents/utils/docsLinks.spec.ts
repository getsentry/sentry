import {
  AI_INSTRUMENTATION_DOCS_LINKS,
  getAiInstrumentationDocsLink,
} from 'sentry/views/insights/pages/agents/utils/docsLinks';

describe('getAiInstrumentationDocsLink', () => {
  it.each(['javascript', 'javascript-react', 'node', 'node-express', 'bun', 'deno'])(
    'returns the JavaScript guide for %s',
    platform => {
      expect(getAiInstrumentationDocsLink(platform)).toBe(
        AI_INSTRUMENTATION_DOCS_LINKS.javascript
      );
    }
  );

  it.each(['python', 'python-django', 'php-laravel', 'ruby', undefined])(
    'defaults to the Python guide for %s',
    platform => {
      expect(getAiInstrumentationDocsLink(platform)).toBe(
        AI_INSTRUMENTATION_DOCS_LINKS.python
      );
    }
  );
});
