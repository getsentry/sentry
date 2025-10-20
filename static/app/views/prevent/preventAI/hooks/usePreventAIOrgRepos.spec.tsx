import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  usePreventAIOrgRepos,
  type PreventAIOrgReposApiResponse,
  type PreventAIOrgReposResponse,
} from './usePreventAIOrgRepos';

describe('usePreventAIOrgRepos', () => {
  const mockOrg = OrganizationFixture({
    preventAiConfigGithub: PreventAIConfigFixture(),
  });

  const mockResponse: PreventAIOrgReposApiResponse = {
    orgRepos: [
      {
        githubOrganizationId: 1,
        name: 'repo1',
        provider: 'github',
        repos: [{id: '1', name: 'repo1', fullName: 'org-1/repo1'}],
      },
      {
        githubOrganizationId: 2,
        name: 'repo2',
        provider: 'github',
        repos: [{id: '2', name: 'repo2', fullName: 'org-2/repo2'}],
      },
    ],
  };

  const transformedMockResponse: PreventAIOrgReposResponse = {
    orgRepos: [
      {
        githubOrganizationId: '1',
        name: 'repo1',
        provider: 'github',
        repos: [{id: '1', name: 'repo1', fullName: 'org-1/repo1'}],
      },
      {
        githubOrganizationId: '2',
        name: 'repo2',
        provider: 'github',
        repos: [{id: '2', name: 'repo2', fullName: 'org-2/repo2'}],
      },
    ],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns data on success', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgRepos(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.data).toEqual(transformedMockResponse));
    expect(result.current.isError).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('returns error on failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      statusCode: 500,
      body: {error: 'Internal Server Error'},
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgRepos(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('refetches data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgRepos(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.data).toEqual(transformedMockResponse));

    const newResponse = {
      orgRepos: [
        {
          githubOrganizationId: 3,
          name: 'repo3',
          provider: 'github',
          repos: [{id: '3', name: 'repo3', fullName: 'org-3/repo3'}],
        },
      ],
    };
    const transformedNewResponse: PreventAIOrgReposResponse = {
      orgRepos: [
        {
          githubOrganizationId: '3',
          name: 'repo3',
          provider: 'github',
          repos: [{id: '3', name: 'repo3', fullName: 'org-3/repo3'}],
        },
      ],
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      body: newResponse,
    });

    result.current.refetch();
    await waitFor(() => expect(result.current.data?.orgRepos?.[0]?.name).toBe('repo3'));
    expect(result.current.data).toEqual(transformedNewResponse);
  });
});
