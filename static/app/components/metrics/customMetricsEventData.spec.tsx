import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {MetricsSummary} from 'sentry/components/events/interfaces/spans/types';
import {CustomMetricsEventData} from 'sentry/components/metrics/customMetricsEventData';
import type {
  MetricsQueryApiResponse,
  MetricsQueryApiResponseLastMeta,
} from 'sentry/types/metrics';

const organization = OrganizationFixture({features: ['custom-metrics']});

describe('CustomMetricsEventData', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/query/`,
      method: 'POST',
      body: {
        data: [[{by: {}, series: [], totals: 2}]],
        meta: [
          [
            {
              unit: 'nanoseconds',
              scaling_factor: 1000000,
              group_bys: {},
              limit: null,
              order: 'asc',
            } as MetricsQueryApiResponseLastMeta,
          ],
        ],
        end: '2023-09-01T01:00:00Z',
        intervals: [],
        start: '2023-09-01T00:00:00Z',
      } satisfies MetricsQueryApiResponse,
    });
  });

  it('renders empty (no feature flag)', () => {
    const metricsSummary: MetricsSummary = {
      'd:custom/my.metric@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    const {container} = render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty (no data)', () => {
    const {container} = render(
      <CustomMetricsEventData
        metricsSummary={{}}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {
        organization,
      }
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders (all information)', () => {
    // This test fails without the mock below, because a nested component uses @container query
    // that is not supported by the version of jsdom currently used by jest.
    jest.spyOn(console, 'error').mockImplementation();

    const metricsSummary: MetricsSummary = {
      'd:custom/my.metric@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();

    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Metric'})).toBeInTheDocument();

    expect(screen.getByText(textWithMarkupMatcher(/Value: 1\.5s/))).toBeInTheDocument();

    expect(screen.getByText(/Tags: foo:bar/)).toBeInTheDocument();
  });

  it('renders (counter metric)', () => {
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {organization}
    );

    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();

    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Metric'})).toBeInTheDocument();

    expect(screen.getByText(textWithMarkupMatcher(/Count: 1/))).toBeInTheDocument();

    expect(screen.getByText(/Tags: foo:bar/)).toBeInTheDocument();
  });

  it('renders (no tags)', async () => {
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: null,
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();

    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Metric'})).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/Count: 1/))).toBeInTheDocument();

    expect(
      await screen.findByText(textWithMarkupMatcher(/Tags: \(none\)/))
    ).toBeInTheDocument();
  });

  it('renders (empty tags)', async () => {
    const metricsSummary: MetricsSummary = {
      'c:custom/my.metric@second': [
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: {},
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();

    expect(screen.getByText('my.metric')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Metric'})).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/Count: 1/))).toBeInTheDocument();

    expect(
      await screen.findByText(textWithMarkupMatcher(/Tags: \(none\)/))
    ).toBeInTheDocument();
  });

  it('renders (multiple)', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/query/`,
      method: 'POST',
      body: {
        data: [
          [{by: {}, series: [], totals: 2}],
          [{by: {}, series: [], totals: 2}],
          [{by: {}, series: [], totals: 2}],
        ],
        meta: [
          [
            {
              unit: 'nanoseconds',
              scaling_factor: 1000000,
              group_bys: {},
              limit: null,
              order: 'asc',
            } as MetricsQueryApiResponseLastMeta,
          ],
          [
            {
              unit: 'nanoseconds',
              scaling_factor: null,
              group_bys: {},
              limit: null,
              order: 'asc',
            } as MetricsQueryApiResponseLastMeta,
          ],
          [
            {
              unit: 'nanoseconds',
              scaling_factor: 1000000,
              group_bys: {},
              limit: null,
              order: 'asc',
            } as MetricsQueryApiResponseLastMeta,
          ],
        ],
        end: '2023-09-01T01:00:00Z',
        intervals: [],
        start: '2023-09-01T00:00:00Z',
      } satisfies MetricsQueryApiResponse,
    });

    const metricsSummary: MetricsSummary = {
      'd:custom/my.distribution@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
        {
          count: 1,
          min: 1,
          max: 1,
          sum: 1,
          tags: null,
        },
      ],
      'c:custom/my.counter@second': [
        {
          count: 2,
          min: 1,
          max: 2,
          sum: 3,
          tags: {
            foo: 'bar',
          },
        },
      ],
    };

    render(
      <CustomMetricsEventData
        metricsSummary={metricsSummary}
        startTimestamp={1706189398.176}
        projectId="1"
      />,
      {
        organization,
      }
    );

    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();

    expect(screen.getByText('my.counter')).toBeInTheDocument();
    expect(screen.getAllByText('my.distribution')).toHaveLength(2);
    expect(screen.getAllByRole('link', {name: 'View Metric'})).toHaveLength(3);
  });
});
