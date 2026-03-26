import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  OrganizationIntegration,
  RepositoryWithSettings,
} from 'sentry/types/integrations';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';

function RepoWithSettingsFixture(
  params: Partial<RepositoryWithSettings> = {}
): RepositoryWithSettings {
  return {
    ...RepositoryFixture(),
    settings: null,
    ...params,
  };
}

function IntegrationFixture(
  params: Partial<OrganizationIntegration> & {features?: string[]} = {}
): OrganizationIntegration {
  const {features = ['commits'], ...rest} = params;
  return {
    id: 'integration-1',
    name: 'Test Integration',
    domainName: 'github.com/test',
    icon: null,
    accountType: null,
    gracePeriodEnd: null,
    organizationIntegrationStatus: 'active',
    status: 'active',
    externalId: 'ext-integration-1',
    organizationId: '1',
    configData: null,
    configOrganization: [],
    provider: {
      key: 'github',
      slug: 'github',
      name: 'GitHub',
      canAdd: true,
      canDisable: false,
      features,
      aspects: {},
    },
    ...rest,
  };
}

describe('useSeerOverviewData', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  function setupMocks({
    repos = [],
    autofixSettings = [],
    integrations = [],
  }: {
    autofixSettings?: Array<{
      autofixAutomationTuning: string | null;
      projectId: string;
      reposCount: number;
    }>;
    integrations?: OrganizationIntegration[];
    repos?: RepositoryWithSettings[];
  } = {}) {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      method: 'GET',
      body: integrations,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      method: 'GET',
      body: repos,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/autofix/automation-settings/',
      method: 'GET',
      body: autofixSettings,
    });
  }

  it('returns zeroed stats when there are no repos or projects', async () => {
    setupMocks();

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats).toEqual({
      integrationCount: 0,
      projectsWithAutomationCount: 0,
      projectsWithCreatePrCount: 0,
      projectsWithReposCount: 0,
      reposWithCodeReviewCount: 0,
      reposWithSettingsCount: 0,
      scmIntegrationCount: 0,
      seerIntegrationCount: 0,
      seerIntegrations: expect.any(Array),
      seerRepoCount: 0,
      totalProjects: 0,
      totalRepoCount: 0,
    });
  });

  it('counts repos and integrations with commits feature', async () => {
    setupMocks({
      repos: [
        RepoWithSettingsFixture({
          id: '1',
          externalId: 'ext-1',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
        RepoWithSettingsFixture({
          id: '2',
          externalId: 'ext-2',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
        RepoWithSettingsFixture({
          id: '3',
          externalId: 'ext-3',
          integrationId: 'integration-b',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
      ],
      integrations: [
        IntegrationFixture({id: 'integration-a', features: ['commits', 'issue-basic']}),
        IntegrationFixture({id: 'integration-b', features: ['commits']}),
        IntegrationFixture({id: 'integration-c', features: ['issue-basic']}), // no commits
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats).toEqual({
      integrationCount: 3,
      projectsWithAutomationCount: 0,
      projectsWithCreatePrCount: 0,
      projectsWithReposCount: 0,
      reposWithCodeReviewCount: 0,
      reposWithSettingsCount: 0,
      scmIntegrationCount: 2,
      seerIntegrationCount: 2,
      seerIntegrations: expect.any(Array),
      seerRepoCount: 3,
      totalProjects: 0,
      totalRepoCount: 3,
    });
  });

  it('only counts repos with supported providers toward seerRepoCount', async () => {
    setupMocks({
      repos: [
        RepoWithSettingsFixture({
          id: '1',
          externalId: 'ext-1',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
        RepoWithSettingsFixture({
          id: '2',
          externalId: 'ext-2',
          integrationId: 'integration-b',
          provider: {id: 'integrations:bitbucket', name: 'Bitbucket'}, // unsupported
        }),
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalRepoCount).toBe(2);
    expect(result.current.stats.seerRepoCount).toBe(1);
  });

  it('counts repos with code review enabled', async () => {
    setupMocks({
      repos: [
        RepoWithSettingsFixture({
          id: '1',
          externalId: 'ext-1',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
          settings: {enabledCodeReview: true, codeReviewTriggers: []},
        }),
        RepoWithSettingsFixture({
          id: '2',
          externalId: 'ext-2',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
          settings: {enabledCodeReview: false, codeReviewTriggers: []},
        }),
        RepoWithSettingsFixture({
          id: '3',
          externalId: 'ext-3',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
          settings: null, // no settings
        }),
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.reposWithCodeReviewCount).toBe(1);
  });

  it('counts projects with repos and with automation enabled', async () => {
    setupMocks({
      autofixSettings: [
        {projectId: '1', reposCount: 2, autofixAutomationTuning: 'medium'},
        {projectId: '2', reposCount: 1, autofixAutomationTuning: 'off'},
        {projectId: '3', reposCount: 0, autofixAutomationTuning: 'off'},
        {projectId: '4', reposCount: 0, autofixAutomationTuning: 'medium'},
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalProjects).toBe(4);
    expect(result.current.stats.projectsWithReposCount).toBe(2);
    expect(result.current.stats.projectsWithAutomationCount).toBe(2);
  });

  it('counts all non-off automation tuning values as enabled', async () => {
    setupMocks({
      autofixSettings: [
        {projectId: '1', reposCount: 1, autofixAutomationTuning: 'medium'},
        {projectId: '2', reposCount: 1, autofixAutomationTuning: 'high'},
        {projectId: '3', reposCount: 1, autofixAutomationTuning: 'always'},
        {projectId: '4', reposCount: 0, autofixAutomationTuning: 'off'},
        {projectId: '5', reposCount: 0, autofixAutomationTuning: null},
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // only 'off' means disabled; null (deprecated) is also treated as enabled
    expect(result.current.stats.projectsWithAutomationCount).toBe(4);
  });

  it('deduplicates repos by externalId', async () => {
    setupMocks({
      repos: [
        RepoWithSettingsFixture({
          id: '1',
          externalId: 'same-external-id',
          integrationId: 'integration-a',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
        RepoWithSettingsFixture({
          id: '2',
          externalId: 'same-external-id', // duplicate
          integrationId: 'integration-b',
          provider: {id: 'integrations:github', name: 'GitHub'},
        }),
      ],
    });

    const {result} = renderHookWithProviders(useSeerOverviewData, {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats.totalRepoCount).toBe(1);
    expect(result.current.stats.seerRepoCount).toBe(1);
  });
});
