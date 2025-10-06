import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  usePreventAIOrgRepos,
  type PreventAIOrgReposResponse,
} from './usePreventAIOrgRepos';

describe('usePreventAIOrgRepos', () => {
  const mockOrg = OrganizationFixture({
    preventAiConfigGithub: PreventAIConfigFixture(),
  });

  const mockResponse: PreventAIOrgReposResponse = {
    orgRepos: [
      {
        id: '1',
        name: 'repo1',
        provider: 'github',
        repos: [
          {id: '1', name: 'repo1', fullName: 'repo1', url: 'https://github.com/repo1'},
        ],
      },
      {
        id: '2',
        name: 'repo2',
        provider: 'github',
        repos: [
          {id: '2', name: 'repo2', fullName: 'repo2', url: 'https://github.com/repo2'},
        ],
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

    await waitFor(() => expect(result.current.data).toEqual(mockResponse));
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

    await waitFor(() => result.current.isError === true);
  });

  it('refetches data', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      body: mockResponse,
    });

    const {result} = renderHookWithProviders(() => usePreventAIOrgRepos(), {
      organization: mockOrg,
    });

    await waitFor(() => expect(result.current.data).toEqual(mockResponse));

    const newResponse = {orgRepos: [{id: '3', name: 'repo3'}]};
    MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/prevent/github/repos/`,
      body: newResponse,
    });

    result.current.refetch();
    await waitFor(() => result.current.data?.orgRepos?.[0]?.name === '3');
    expect(result.current.data).toEqual(newResponse);
  });
});
