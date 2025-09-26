// eslint-disable-next-line import/no-nodejs-modules
import fs from 'node:fs';
// eslint-disable-next-line import/no-nodejs-modules
import path from 'node:path';

import {DiscoverSeriesFixture} from 'sentry-fixture/discoverSeries';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import type {ChartId} from './chartWidgetLoader';
import {ChartWidgetLoader} from './chartWidgetLoader';

function mockDiscoverSeries(seriesName: string) {
  return DiscoverSeriesFixture({
    seriesName,
  });
}

function mockTimeSeries(yAxis: string, groupBy?: string[]) {
  const partialTimeseries: Partial<TimeSeries> = {yAxis};
  if (groupBy) {
    partialTimeseries.groupBy = groupBy.map(group => ({key: group, value: group}));
  }
  return TimeSeriesFixture(partialTimeseries);
}

// Mock this component so it doesn't yell at us for no plottables
jest.mock(
  'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization',
  () => {
    const TimeSeriesWidgetVisualizationMock = jest.fn(() => null);
    return {
      TimeSeriesWidgetVisualization: TimeSeriesWidgetVisualizationMock,
    };
  }
);

jest.mock('sentry/views/insights/sessions/queries/useReleaseNewIssues', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    isError: false,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useRecentIssues', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    recentIssues: [],
    isPending: false,
    isError: false,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useNewAndResolvedIssues', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    isError: false,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useCrashFreeSessions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    isError: false,
  })),
}));
jest.mock('sentry/views/insights/common/queries/useDiscover', () => ({
  useSpans: jest.fn(() => ({
    data: [
      {
        'epm()': {},
        'avg(span.duration)': 123,
        'sum(span.duration)': 456,
        'span.group': 'abc123',
        'span.description': 'span1',
        'sentry.normalized_description': 'span1',
        'project.id': 123,
        transaction: 'transaction_a',
      },
    ],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/common/queries/useTopNDiscoverSeries', () => ({
  useTopNSpanSeries: jest.fn(() => ({
    data: [mockDiscoverSeries('transaction_a,abc123')],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/common/queries/useDiscoverSeries', () => ({
  useSpanSeries: jest.fn(() => ({
    data: {
      'epm()': {},
      'count(span.duration)': mockDiscoverSeries('count(span.duration)'),
      'avg(span.duration)': mockDiscoverSeries('avg(span.duration)'),
      'p95(span.duration)': mockDiscoverSeries('p95(span.duration)'),
      'trace_status_rate(internal_error)': mockDiscoverSeries(
        'trace_status_rate(internal_error)'
      ),
      'cache_miss_rate()': {},
      'http_response_rate(3)': {},
      'http_response_rate(4)': {},
      'http_response_rate(5)': {},
      'avg(span.self_time)': {},
      'avg(http.response_content_length)': {},
      'avg(http.response_transfer_size)': {},
      'avg(http.decoded_response_content_length)': {},
      'avg(messaging.message.receive.latency)': {},
      'performance_score(measurements.score.lcp)': {
        data: [],
      },
      'performance_score(measurements.score.fcp)': {
        data: [],
      },
      'performance_score(measurements.score.cls)': {
        data: [],
      },
      'performance_score(measurements.score.inp)': {
        data: [],
      },
      'performance_score(measurements.score.ttfb)': {
        data: [],
      },
      'count()': {
        data: [],
      },
    },
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/utils/timeSeries/useFetchEventsTimeSeries', () => ({
  useFetchSpanTimeSeries: jest.fn(({groupBy}: {groupBy?: string[]}) => ({
    data: {
      timeSeries: [
        mockTimeSeries('epm()'),
        mockTimeSeries('count(span.duration)'),
        mockTimeSeries('avg(span.duration)'),
        mockTimeSeries('p95(span.duration)'),
        mockTimeSeries('trace_status_rate(internal_error)'),
        mockTimeSeries('cache_miss_rate()', groupBy),
        mockTimeSeries('http_response_rate(3)'),
        mockTimeSeries('http_response_rate(4)'),
        mockTimeSeries('http_response_rate(5)'),
        mockTimeSeries('avg(span.self_time)'),
        mockTimeSeries('avg(http.response_content_length)'),
        mockTimeSeries('avg(http.response_transfer_size)'),
        mockTimeSeries('avg(http.decoded_response_content_length)'),
        mockTimeSeries('avg(messaging.message.receive.latency)'),
        mockTimeSeries('performance_score(measurements.score.lcp)'),
        mockTimeSeries('performance_score(measurements.score.fcp)'),
        mockTimeSeries('performance_score(measurements.score.cls)'),
        mockTimeSeries('performance_score(measurements.score.inp)'),
        mockTimeSeries('performance_score(measurements.score.ttfb)'),
        mockTimeSeries('count()'),
      ],
    },
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useErroredSessions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useSessionHealthBreakdown', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useReleaseSessionPercentage', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useReleaseSessionCounts', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useUserHealthBreakdown', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [{}],
    isPending: false,
    error: null,
  })),
}));
// Dynamically get all widget IDs from the widgets directory
const WIDGETS_DIR = path.join(
  __dirname,
  '../../views/insights/common/components/widgets'
);
const widgetIds = fs
  .readdirSync(WIDGETS_DIR)
  .filter(
    file =>
      file.endsWith('.tsx') &&
      file !== 'types.tsx' &&
      !fs.statSync(path.join(WIDGETS_DIR, file)).isDirectory()
  )
  .map(file => file.replace('.tsx', ''));

describe('ChartWidgetLoader - unmocked imports', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    // Mock API responses
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: {
        data: [[123, []]],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  // All widgets in `static/app/views/insights/common/components/widgets` must:
  // - have a `id` prop with the widget name
  // - `id` must match the filename
  // - have a `default` export that is a React component (component name should be TitleCase of `id`)
  // - be mapped via `id` -> dynamic import in `chartWidgetLoader.tsx`
  it.each(widgetIds as ChartId[])(
    'can load widget: %s',
    async widgetId => {
      render(<ChartWidgetLoader id={widgetId} />);

      // Initially should show loading state from ChartWidgetLoader, it will disappear when dynamic import completes.
      // We only need to check that the dynamic import completes for these tests as that means ChartWidgetLoader is able to load all widgets
      await waitFor(
        () => {
          expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
        },
        {
          timeout: 10_000,
        }
      );

      expect(TimeSeriesWidgetVisualization).toHaveBeenCalledWith(
        expect.objectContaining({
          id: widgetId,
        }),
        undefined
      );
    },
    15_000
  );

  it('shows error state for invalid widget id', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // @ts-expect-error - fails type check because `invalid-widget` is not a valid chart id, but we want to test that it shows an error state
    render(<ChartWidgetLoader id="invalid-widget" />);

    await waitFor(() => {
      expect(screen.getByText('Error loading widget')).toBeInTheDocument();
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
