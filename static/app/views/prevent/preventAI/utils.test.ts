import {getRepoNameWithoutOrg} from 'sentry/views/prevent/preventAI/utils';

describe('getRepoNameWithoutOrg', () => {
  it('returns the repo name when given a full name with org/repo', () => {
    expect(getRepoNameWithoutOrg('org1/repo1')).toBe('repo1');
    expect(getRepoNameWithoutOrg('my-org/another-repo')).toBe('another-repo');
  });

  it('returns the input string when there is no slash', () => {
    expect(getRepoNameWithoutOrg('justrepo')).toBe('justrepo');
    expect(getRepoNameWithoutOrg('repoOnlyName')).toBe('repoOnlyName');
  });

  it('handles empty strings', () => {
    expect(getRepoNameWithoutOrg('')).toBe('');
  });

  it('returns the last portion if there are multiple slashes', () => {
    expect(getRepoNameWithoutOrg('org/foo/bar/repo-test')).toBe('repo-test');
    expect(getRepoNameWithoutOrg('////repo')).toBe('repo');
  });
});
