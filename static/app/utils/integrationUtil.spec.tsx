import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';

import {
  getAlertText,
  getGithubPermissionsUpdateUrl,
  getIntegrationNoun,
  getIntegrationSourceUrl,
} from 'sentry/utils/integrationUtil';

describe('getIntegrationSourceUrl()', () => {
  it('returns the correct url for Bitbucket', () => {
    const result = getIntegrationSourceUrl('bitbucket', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for Bitbucket Server', () => {
    const result = getIntegrationSourceUrl('bitbucket_server', 'https://example.com', 10);
    expect(result).toBe('https://example.com#lines-10');
  });

  it('returns the correct url for GitHub', () => {
    const result = getIntegrationSourceUrl('github', 'https://example.com', 10);
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for GitHub Enterprise', () => {
    const result = getIntegrationSourceUrl(
      'github_enterprise',
      'https://example.com',
      10
    );
    expect(result).toBe('https://example.com#L10');
  });

  it('returns the correct url for VSTS', () => {
    const result = getIntegrationSourceUrl('vsts', 'https://example.com', 10);
    expect(result).toBe(
      'https://example.com/?line=10&lineEnd=11&lineStartColumn=1&lineEndColumn=1&lineStyle=plain&_a=contents'
    );
  });
});

describe('getIntegrationNoun()', () => {
  it('returns "GitHub App installation" for github', () => {
    expect(getIntegrationNoun('github')).toBe('GitHub App installation');
  });

  it('returns "workspace" for slack', () => {
    expect(getIntegrationNoun('slack')).toBe('workspace');
  });

  it('returns "installation" for unknown providers', () => {
    expect(getIntegrationNoun('jira')).toBe('installation');
  });
});

describe('getAlertText()', () => {
  it('returns undefined when no integrations are provided', () => {
    expect(getAlertText()).toBeUndefined();
    expect(getAlertText([])).toBeUndefined();
  });

  it('returns undefined when no integration is out of date', () => {
    const integration = GitHubIntegrationFixture({outOfDate: false});
    expect(getAlertText([integration])).toBeUndefined();
  });

  it('returns the GitHub message for an outdated github integration', () => {
    const integration = GitHubIntegrationFixture({outOfDate: true});
    expect(getAlertText([integration])).toBe(
      'Update to the latest version of our GitHub App to get access to the latest features.'
    );
  });

  it('returns the Slack message for an outdated slack integration', () => {
    const integration = GitHubIntegrationFixture({
      outOfDate: true,
      provider: {
        ...GitHubIntegrationFixture().provider,
        key: 'slack',
        name: 'Slack',
      },
    });
    expect(getAlertText([integration])).toBe(
      'Chat, ask questions, and debug with Sentry in the new Slack app. Please reinstall the Slack app on your workspace to get started.'
    );
  });

  it('returns undefined for an outdated integration of another provider', () => {
    const integration = GitHubIntegrationFixture({
      outOfDate: true,
      provider: {
        ...GitHubIntegrationFixture().provider,
        key: 'jira',
        name: 'Jira',
      },
    });
    expect(getAlertText([integration])).toBeUndefined();
  });
});

describe('getGithubPermissionsUpdateUrl()', () => {
  it('uses the personal namespace for a user-owned installation', () => {
    expect(
      getGithubPermissionsUpdateUrl({
        externalId: '123456',
        accountType: 'User',
        name: 'example-user',
      })
    ).toBe('https://github.com/settings/installations/123456/permissions/update');
  });

  it('uses the organization namespace for an org-owned installation', () => {
    expect(
      getGithubPermissionsUpdateUrl({
        externalId: '654321',
        accountType: 'Organization',
        name: 'example-org',
      })
    ).toBe(
      'https://github.com/organizations/example-org/settings/installations/654321/permissions/update'
    );
  });

  it('returns undefined without an installation id', () => {
    expect(
      getGithubPermissionsUpdateUrl({
        externalId: undefined,
        accountType: 'User',
        name: 'example-user',
      })
    ).toBeUndefined();
  });

  it('returns undefined for an org install with no account name', () => {
    expect(
      getGithubPermissionsUpdateUrl({
        externalId: '654321',
        accountType: 'Organization',
        name: '',
      })
    ).toBeUndefined();
  });
});
