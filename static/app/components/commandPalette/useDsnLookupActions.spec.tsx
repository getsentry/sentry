import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useDsnLookupActions} from 'sentry/components/commandPalette/useDsnLookupActions';

describe('useDsnLookupActions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns actions for a valid DSN', async () => {
    const dsn = 'https://abc123def456abc123def456abc123de@o1.ingest.sentry.io/123';
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dsn-lookup/',
      body: {
        organizationSlug: 'test-org',
        projectSlug: 'test-project',
        projectId: '42',
        projectName: 'Test Project',
        projectPlatform: 'javascript',
        keyLabel: 'Default',
        keyId: '1',
      },
      match: [MockApiClient.matchQuery({dsn})],
    });

    const {result} = renderHookWithProviders(() => useDsnLookupActions(dsn));

    await waitFor(() => {
      expect(result.current.length).toBeGreaterThan(0);
    });

    expect(result.current).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'dsn-lookup-issues',
          type: 'navigate',
          to: '/organizations/test-org/issues/?project=42',
        }),
        expect.objectContaining({
          key: 'dsn-lookup-project-settings',
          type: 'navigate',
          to: '/settings/test-org/projects/test-project/',
        }),
        expect.objectContaining({
          key: 'dsn-lookup-client-keys',
          type: 'navigate',
          to: '/settings/test-org/projects/test-project/keys/',
        }),
      ])
    );
  });

  it('returns empty array for non-DSN query', () => {
    const mockApi = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dsn-lookup/',
      body: {},
    });

    const {result} = renderHookWithProviders(() =>
      useDsnLookupActions('some random text')
    );

    expect(result.current).toEqual([]);
    expect(mockApi).not.toHaveBeenCalled();
  });

  it('returns empty array for empty query', () => {
    const mockApi = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dsn-lookup/',
      body: {},
    });

    const {result} = renderHookWithProviders(() => useDsnLookupActions(''));

    expect(result.current).toEqual([]);
    expect(mockApi).not.toHaveBeenCalled();
  });
});
