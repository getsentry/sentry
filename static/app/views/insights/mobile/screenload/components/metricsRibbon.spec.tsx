import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MobileMetricsRibbon} from 'sentry/views/insights/mobile/screenload/components/metricsRibbon';

jest.mock('sentry/utils/usePageFilters');

describe('MetricsRibbon', function () {
  const organization = OrganizationFixture();
  const project = ProjectFixture();

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
      projects: [parseInt(project.id, 10)],
    },
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/releases/`,
    body: [
      {
        id: 970136705,
        version: 'com.example.vu.android@2.10.5',
        dateCreated: '2023-12-19T21:37:53.895495Z',
      },
      {
        id: 969902997,
        version: 'com.example.vu.android@2.10.3+42',
        dateCreated: '2023-12-19T18:04:06.953025Z',
      },
    ],
  });

  it('makes a request to discover with the correct dataset and fields', async function () {
    const mockEventsQuery = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [{title: 'test-transaction', 'count()': 1, 'avg(duration)': 1000}],
      },
    });

    render(
      <MobileMetricsRibbon
        dataset={DiscoverDatasets.SPANS_METRICS}
        filters={[
          'duration:>0',
          'transaction.op:ui.load',
          'transaction:test-transaction',
        ]}
        blocks={[
          {dataKey: 'count()', title: 'Count', unit: 'count'},
          {
            dataKey: 'avg(duration)',
            title: 'Custom Header',
            unit: DurationUnit.MILLISECOND,
          },
        ]}
        fields={['count()', 'avg(duration)']}
        referrer="test-referrer"
      />
    );

    expect(screen.getByText('Custom Header')).toBeInTheDocument();
    expect(screen.getByText('Count')).toBeInTheDocument();

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText('1.00s')).toBeInTheDocument();

    expect(mockEventsQuery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'duration:>0 transaction.op:ui.load transaction:test-transaction',
          referrer: 'test-referrer',
          dataset: 'spansMetrics',
          field: ['count()', 'avg(duration)'],
        }),
      })
    );
  });
});
