import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScmIntegrationTreeData} from './useScmIntegrationTreeData';

describe('useScmIntegrationTreeData', () => {
  const organization = OrganizationFixture();

  const githubProvider = {
    key: 'github',
    slug: 'github',
    name: 'GitHub',
    canAdd: true,
    canDisable: false,
    features: ['commits'],
    metadata: {
      aspects: {},
      author: 'The Sentry Team',
      description: '',
      features: [{featureId: 1, featureGate: 'integrations-commits', description: ''}],
      issue_url: '',
      noun: 'Installation',
      source_url: '',
    },
    setupDialog: {height: 600, url: '', width: 600},
  };

  const githubIntegration = {
    id: '1',
    name: 'GitHub',
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features: [],
      aspects: {},
    },
    domainName: 'github.com/test',
    icon: null,
    accountType: null,
    gracePeriodEnd: null,
    organizationIntegrationStatus: 'active',
    status: 'active',
  };

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
