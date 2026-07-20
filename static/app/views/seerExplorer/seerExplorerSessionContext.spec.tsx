import {buildRunsSearchQuery} from 'sentry/views/seerExplorer/seerExplorerSessionContext';

describe('buildRunsSearchQuery', () => {
  it('scopes to the current user and Explorer sessions when there is no search', () => {
    expect(buildRunsSearchQuery()).toBe('is:mine type:explorer');
    expect(buildRunsSearchQuery('')).toBe('is:mine type:explorer');
    expect(buildRunsSearchQuery('   ')).toBe('is:mine type:explorer');
  });

  it('wraps free-text search in quotes so it stays a title filter', () => {
    expect(buildRunsSearchQuery('database error')).toBe(
      'is:mine type:explorer "database error"'
    );
  });

  it('trims the search before quoting', () => {
    expect(buildRunsSearchQuery('  padded  ')).toBe('is:mine type:explorer "padded"');
  });

  it('quotes input that looks like structured search instead of parsing it', () => {
    // Without quoting these would be parsed by the runs search grammar and 400.
    expect(buildRunsSearchQuery('unknownkey:value')).toBe(
      'is:mine type:explorer "unknownkey:value"'
    );
    expect(buildRunsSearchQuery('type:not-a-real-type')).toBe(
      'is:mine type:explorer "type:not-a-real-type"'
    );
  });

  it('escapes embedded double quotes', () => {
    expect(buildRunsSearchQuery('say "hi"')).toBe('is:mine type:explorer "say \\"hi\\""');
  });
});
