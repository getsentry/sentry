import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';

describe('useProfileFunctions', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('initializes with the loading state', () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    const hook = renderHookWithProviders(useProfileFunctions<string>, {
      initialProps: {
        fields: ['count()'],
        referrer: '',
        sort: {
          key: 'count()',
          order: 'desc',
        },
      },
    });
    expect(hook.result.current).toMatchObject(
      expect.objectContaining({
        isInitialLoading: true,
      })
    );
  });

  it('fetches functions', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    const hook = renderHookWithProviders(useProfileFunctions<string>, {
      initialProps: {
        fields: ['count()'],
        referrer: '',
        sort: {
          key: 'count()',
          order: 'desc',
        },
      },
    });
    expect(hook.result.current.isPending).toBe(true);
    expect(hook.result.current.isFetched).toBe(false);
    await waitFor(() =>
      expect(hook.result.current).toMatchObject(
        expect.objectContaining({
          isLoading: false,
          isFetched: true,
          data: expect.objectContaining({
            data: expect.any(Array),
          }),
        })
      )
    );
  });
});
