import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {metricDetectorQuotaApiOptions} from 'sentry/views/detectors/hooks';

import {useUpdateDetectorsMutation} from './useEditDetectorsMutation';

describe('useUpdateDetectorsMutation', () => {
  const organization = OrganizationFixture();

  it('refreshes the metric detector quota after enabling detectors', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      method: 'PUT',
      body: {},
    });
    const queryClient = makeTestQueryClient();
    const quotaKey = metricDetectorQuotaApiOptions(organization).queryKey;
    queryClient.setQueryData(quotaKey, {
      headers: {},
      json: {count: 2, limit: 3, hasReachedLimit: false},
    });

    const {result} = renderHookWithProviders(useUpdateDetectorsMutation, {
      organization,
      additionalWrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    act(() => result.current.mutate({enabled: true, ids: ['1']}));

    await waitFor(() =>
      expect(queryClient.getQueryState(quotaKey)?.isInvalidated).toBe(true)
    );
  });
});
