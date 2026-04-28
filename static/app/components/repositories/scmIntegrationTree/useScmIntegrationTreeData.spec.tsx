import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScmIntegrationTreeData} from './useScmIntegrationTreeData';

describe('useScmIntegrationTreeData', () => {
  const organization = OrganizationFixture();

  const githubProvider = GitHubIntegrationProviderFixture();

  const githubIntegration = GitHubIntegrationFixture();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [githubProvider]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: {results: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/1/repos/`,
      body: {repos: [], searchable: false},
    });
  });

  it('filters out null integration items from the API response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [githubIntegration, null],
    });

    const {result} = renderHookWithProviders(useScmIntegrationTreeData, {
      organization,
    });

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.scmIntegrations).toHaveLength(1);
    expect(result.current.scmIntegrations[0]!.id).toBe('1');
  });
});
