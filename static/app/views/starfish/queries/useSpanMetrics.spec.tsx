import {ReactNode} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {MetricsProperty} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

function Wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanMetrics', () => {
  const organization = Organization();

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  it('queries for current selection', async () => {
    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.op': 'db',
            'spm()': 1486.3201388888888,
            'count()': 2140301,
          },
        ],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      ({group, filters, fields}) => useSpanMetrics(group, filters, fields),
      {
        wrapper: Wrapper,
        initialProps: {
          group: '221aa7ebd216',
          filters: {
            transactionName: '/api/details',
            release: '0.0.1',
          },
          fields: ['spm()'] as MetricsProperty[],
        },
      }
    );

    expect(result.current.isLoading).toEqual(true);

    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        method: 'GET',
        query: expect.objectContaining({
          query: `span.group:221aa7ebd216 transaction:"/api/details" release:0.0.1`,
          dataset: 'spansMetrics',
          statsPeriod: '10d',
          field: ['spm()'],
        }),
      })
    );

    await waitForNextUpdate();

    expect(result.current.isLoading).toEqual(false);
    expect(result.current.data).toEqual({
      'span.op': 'db',
      'spm()': 1486.3201388888888,
      'count()': 2140301,
    });
  });
});
