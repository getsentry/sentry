import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';

import {useRepo} from './useRepo';

const mockPreventContext = {
  integratedOrgId: 'org123',
  repository: 'test-repo',
  branch: 'main',
  preventPeriod: '30d',
  changeContextValue: jest.fn(),
};

describe('useRepo', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches repository data successfully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});
    const mockRepoData = {
      testAnalyticsEnabled: true,
      uploadToken: 'test-token-123',
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/org123/repository/test-repo/`,
      body: mockRepoData,
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={mockPreventContext}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useRepo, {
      additionalWrapper,
      organization,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockRepoData);
    expect(result.current.data?.testAnalyticsEnabled).toBe(true);
    expect(result.current.data?.uploadToken).toBe('test-token-123');
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/org123/repository/test-repo/`,
      statusCode: 404,
      body: {detail: 'Repository not found'},
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={mockPreventContext}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useRepo, {
      additionalWrapper,
      organization,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
