import {QueryClientProvider} from '@tanstack/react-query';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';

describe('useTraceItemAttributes', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('retains attributes while fetching a new search in the same scope', async () => {
    const queryClient = makeTestQueryClient();
    const url = '/organizations/org-slug/trace-items/attributes/';
    MockApiClient.addMockResponse({
      url,
      body: [
        {
          key: 'custom.unique',
          name: 'custom.unique',
          attributeType: 'string',
          attributeSource: {source_type: 'user'},
        },
      ],
    });
    let finishRequest!: () => void;
    const searchRequest = MockApiClient.addMockResponse({
      url,
      body: [],
      match: [MockApiClient.matchQuery({substringMatch: 'other'})],
      asyncDelay: new Promise<void>(resolve => {
        finishRequest = resolve;
      }),
    });

    const {result, rerender} = renderHookWithProviders(
      ({search}) => useLogItemAttributes({search, projects: [1]}),
      {
        initialProps: {search: ''},
        additionalWrapper: ({children}) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }
    );
    await waitFor(() => expect(result.current.attributes['custom.unique']).toBeDefined());

    rerender({search: 'other'});
    await waitFor(() => expect(searchRequest).toHaveBeenCalled());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.attributes['custom.unique']).toBeDefined();

    act(() => finishRequest());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.attributes['custom.unique']).toBeUndefined();
  });
});
