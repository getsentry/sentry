import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {GitLabIntegrationProviderFixture} from 'sentry-fixture/gitlabIntegrationProvider';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ScmProviderPills} from './scmProviderPills';

const bitbucketProvider = GitHubIntegrationProviderFixture({
  key: 'bitbucket',
  slug: 'bitbucket',
  name: 'Bitbucket',
});

const bitbucketServerProvider = GitHubIntegrationProviderFixture({
  key: 'bitbucket_server',
  slug: 'bitbucket_server',
  name: 'Bitbucket Server',
});

const gitHubEnterpriseProvider = GitHubIntegrationProviderFixture({
  key: 'github_enterprise',
  slug: 'github_enterprise',
  name: 'GitHub Enterprise',
});

const azureDevOpsProvider = GitHubIntegrationProviderFixture({
  key: 'vsts',
  slug: 'vsts',
  name: 'Azure DevOps',
});

describe('ScmProviderPills', () => {
  it('renders primary providers as top-level buttons', () => {
    const providers = [
      GitHubIntegrationProviderFixture(),
      GitLabIntegrationProviderFixture(),
      bitbucketProvider,
    ];

    render(<ScmProviderPills providers={providers} onInstall={jest.fn()} />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });

  it('shows secondary providers in a "More" dropdown', async () => {
    const providers = [
      GitHubIntegrationProviderFixture(),
      GitLabIntegrationProviderFixture(),
      bitbucketProvider,
      bitbucketServerProvider,
      gitHubEnterpriseProvider,
      azureDevOpsProvider,
    ];

    render(<ScmProviderPills providers={providers} onInstall={jest.fn()} />);

    // Primary providers are visible as buttons
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('GitLab')).toBeInTheDocument();
    expect(screen.getByText('Bitbucket')).toBeInTheDocument();

    // Secondary providers are hidden behind the "More" dropdown
    expect(screen.queryByText('Bitbucket Server')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'More'}));

    expect(
      screen.getByRole('menuitemradio', {name: 'Bitbucket Server'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitemradio', {name: 'GitHub Enterprise'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Azure DevOps'})).toBeInTheDocument();
  });

  it('triggers install flow when clicking a dropdown item', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue({
      focus: jest.fn(),
      close: jest.fn(),
    } as any);

    const providers = [GitHubIntegrationProviderFixture(), gitHubEnterpriseProvider];

    render(<ScmProviderPills providers={providers} onInstall={jest.fn()} />);

    await userEvent.click(screen.getByRole('button', {name: 'More'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'GitHub Enterprise'}));

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not render "More" dropdown when all providers are primary', () => {
    const providers = [GitHubIntegrationProviderFixture()];

    render(<ScmProviderPills providers={providers} onInstall={jest.fn()} />);

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.queryByText('More')).not.toBeInTheDocument();
  });
});
