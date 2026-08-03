import {AutofixRepoPRStateFixture} from 'sentry-fixture/autofix';

import {
  getCodingAgentResultLink,
  getRepoPullRequestLink,
} from 'sentry/components/events/autofix/pullRequests';

describe('getRepoPullRequestLink', () => {
  it.each([
    ['github', 'https://github.com/org/repository/pull/10'],
    ['gitlab', 'https://gitlab.com/org/repository/-/merge_requests/10'],
  ])('preserves the %s repository provider', (provider, url) => {
    expect(
      getRepoPullRequestLink(
        AutofixRepoPRStateFixture({
          provider,
          pr_url: url,
        })
      )
    ).toEqual({
      kind: 'pullRequest',
      label: 'View org/repository#10',
      repoProvider: provider,
      url,
    });
  });
});

describe('getCodingAgentResultLink', () => {
  const result = {
    description: 'Implemented the fix',
    repo_full_name: 'org/repository',
    repo_provider: 'github',
  };

  it('identifies GitHub pull requests', () => {
    expect(
      getCodingAgentResultLink({
        ...result,
        pr_url: 'https://github.com/org/repository/pull/10',
      })
    ).toEqual({
      kind: 'pullRequest',
      label: 'View Pull Request',
      repoProvider: 'github',
      url: 'https://github.com/org/repository/pull/10',
    });
  });

  it('preserves non-GitHub repository providers', () => {
    expect(
      getCodingAgentResultLink({
        ...result,
        repo_provider: 'gitlab',
        pr_url: 'https://gitlab.com/org/repository/-/merge_requests/10',
      })
    ).toEqual({
      kind: 'pullRequest',
      label: 'View Pull Request',
      repoProvider: 'gitlab',
      url: 'https://gitlab.com/org/repository/-/merge_requests/10',
    });
  });

  it('identifies branch links', () => {
    expect(
      getCodingAgentResultLink({
        ...result,
        pr_url: 'https://github.com/org/repository/tree/seer/fix',
      })
    ).toEqual({
      kind: 'branch',
      label: 'View Branch',
      repoProvider: 'github',
      url: 'https://github.com/org/repository/tree/seer/fix',
    });
  });
});
