import {ReactNode} from 'react';
import {Organization} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanList} from 'sentry/views/starfish/queries/useSpanList';
import {SpanMetricsQueryFilters} from 'sentry/views/starfish/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useOrganization');

function wrapper({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
}

describe('useSpanList', () => {
  const organization = Organization();

  jest.mocked(useOrganization).mockReturnValue(organization);

  it('queries for current selection', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {
        statsPeriod: '10d',
      },
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });

    const eventsRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.description': 'SELECT .. FROM sentry_apitoken;',
            'spm()': 44,
          },
        ],
      },
    });

    const {result, waitForNextUpdate} = reactHooks.renderHook(
      ({filters, sorts, limit}) => useSpanList(filters, sorts, limit),
      {
        wrapper,
        initialProps: {
          filters: {
            'span.module': 'db',
            'span.action': 'SELECT',
          } as SpanMetricsQueryFilters,
          sorts: [],
          limit: 11,
        },
      }
    );

    expect(result.current.isLoading).toEqual(true);

    expect(eventsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        method: 'GET',

        query: {
          query: `span.module:db span.action:SELECT has:span.description`,
          dataset: 'spansMetrics',
          statsPeriod: '10d',
          environment: [],
          project: [],
          referrer: 'api.starfish.use-span-list',
          field: [
            'project.id',
            'span.op',
            'span.group',
            'span.description',
            'span.domain',
            'spm()',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'http_error_count()',
            'time_spent_percentage()',
          ],
          per_page: 11,
        },
      })
    );

    await waitForNextUpdate();

    expect(result.current.isLoading).toEqual(false);
    expect(result.current.data).toEqual([
      {
        'span.description': 'SELECT .. FROM sentry_apitoken;',
        'spm()': 44,
      },
    ]);
  });
});
