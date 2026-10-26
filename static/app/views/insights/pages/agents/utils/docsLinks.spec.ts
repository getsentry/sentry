import {
  AI_AGENTS_GETTING_STARTED_DOCS_LINK,
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

  it.each(['python', 'python-django'])('returns the Python guide for %s', platform => {
    expect(getAiInstrumentationDocsLink(platform)).toBe(
      AI_INSTRUMENTATION_DOCS_LINKS.python
    );
  });

  it.each(['php-laravel', 'ruby', undefined])(
    'falls back to the getting-started guide for %s',
    platform => {
      expect(getAiInstrumentationDocsLink(platform)).toBe(
        AI_AGENTS_GETTING_STARTED_DOCS_LINK
      );
    }
  );
});
