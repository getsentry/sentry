import {getIssueSearchQuery} from 'sentry/components/seer/markdown/embeds/components/issue';

describe('getIssueSearchQuery', () => {
  it('uses the database ID filter for numeric issue identifiers', () => {
    expect(getIssueSearchQuery('34')).toBe('issue.id:34');
  });

  it('uses the short ID filter for human-readable issue identifiers', () => {
    expect(getIssueSearchQuery('SEER-TEST-SANDBOX-PYTHON-1')).toBe(
      'issue:SEER-TEST-SANDBOX-PYTHON-1'
    );
  });
});
