import {DetectedPlatformFixture} from 'sentry-fixture/detectedPlatform';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useScmPlatformDetection} from './useScmPlatformDetection';

describe('useScmPlatformDetection', () => {
  const organization = OrganizationFixture();
  const githubRepo = RepositoryFixture({
    id: '42',
    provider: {id: 'integrations:github', name: 'GitHub'},
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns detected platforms from API response', async () => {
    const mockPlatforms = [
      DetectedPlatformFixture(),
      DetectedPlatformFixture({
        platform: 'python-django',
        language: 'Python',
        confidence: 'medium',
        bytes: 30000,
        priority: 2,
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {platforms: mockPlatforms},
    });

    const {result} = renderHookWithProviders(() => useScmPlatformDetection(githubRepo), {
      organization,
    });

    await waitFor(() => {
      expect(result.current.detectedPlatforms).toEqual(mockPlatforms);
    });
  });

  it('returns empty array when repository is undefined', () => {
    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/undefined/platforms/`,
      body: {platforms: []},
    });

    const {result} = renderHookWithProviders(() => useScmPlatformDetection(undefined), {
      organization,
    });

    expect(result.current.detectedPlatforms).toEqual([]);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it('returns isPending while loading', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      body: {platforms: []},
    });

    const {result} = renderHookWithProviders(() => useScmPlatformDetection(githubRepo), {
      organization,
    });

    expect(result.current.isPending).toBe(true);
  });

  it('returns isError on API failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/42/platforms/`,
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    const {result} = renderHookWithProviders(() => useScmPlatformDetection(githubRepo), {
      organization,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('skips detection for non-GitHub providers', () => {
    const gitlabRepo = RepositoryFixture({
      id: '99',
      provider: {id: 'integrations:gitlab', name: 'GitLab'},
    });

    const apiMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/99/platforms/`,
      body: {platforms: []},
    });

    const {result} = renderHookWithProviders(() => useScmPlatformDetection(gitlabRepo), {
      organization,
    });

    expect(apiMock).not.toHaveBeenCalled();
    expect(result.current.detectedPlatforms).toEqual([]);
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
