// eslint-disable-next-line import/no-nodejs-modules
import fs from 'node:fs';
// eslint-disable-next-line import/no-nodejs-modules
import path from 'node:path';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

import {ChartWidgetLoader} from './chartWidgetLoader';

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

jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery',
  () => ({
    useDatabaseLandingDurationQuery: jest.fn(() => ({
      data: {},
      isPending: false,
      error: null,
    })),
  })
);
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery',
  () => ({
    useDatabaseLandingThroughputQuery: jest.fn(() => ({
      data: {},
      isPending: false,
      error: null,
    })),
  })
);
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useAiPipelineGroup',
  () => ({
    useAiPipelineGroup: jest.fn(() => ({
      data: {},
      isPending: false,
      error: null,
    })),
  })
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
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useResourceLandingSeries',
  () => ({
    useResourceLandingSeries: jest.fn(() => ({
      data: {
        'epm()': {},
        'avg(span.self_time)': {},
        'avg(http.response_content_length)': {},
        'avg(http.response_transfer_size)': {},
        'avg(http.decoded_response_content_length)': {},
      },
      isPending: false,
      error: null,
    })),
  })
);
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useResourceSummarySeries',
  () => ({
    useResourceSummarySeries: jest.fn(() => ({
      data: {
        'epm()': {},
        'avg(span.self_time)': {},
        'avg(http.response_content_length)': {},
        'avg(http.response_transfer_size)': {},
        'avg(http.decoded_response_content_length)': {},
      },
      isPending: false,
      error: null,
    })),
  })
);
jest.mock('sentry/views/insights/queues/queries/usePublishQueuesTimeSeriesQuery', () => ({
  usePublishQueuesTimeSeriesQuery: jest.fn(() => ({
    data: {},
    isPending: false,
    error: null,
  })),
}));
jest.mock('sentry/views/insights/queues/queries/useProcessQueuesTimeSeriesQuery', () => ({
  useProcessQueuesTimeSeriesQuery: jest.fn(() => ({
    data: {
      'avg(messaging.message.receive.latency)': {},
    },
    isPending: false,
    error: null,
  })),
}));
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery',
  () => ({
    useDatabaseLandingDurationQuery: jest.fn(() => ({
      data: {
        'avg(span.self_time)': {},
      },
      isPending: false,
      error: null,
    })),
  })
);
jest.mock(
  'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery',
  () => ({
    useDatabaseLandingThroughputQuery: jest.fn(() => ({
      data: {
        'epm()': {},
      },
      isPending: false,
      error: null,
    })),
  })
);
jest.mock('sentry/views/insights/common/queries/useDiscoverSeries', () => ({
  useMetricsSeries: jest.fn(() => ({
    data: {
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
  useSpanMetricsSeries: jest.fn(() => ({
    data: {
      'cache_miss_rate()': {},
      'http_response_rate(3)': {},
      'http_response_rate(4)': {},
      'http_response_rate(5)': {},
      'epm()': {},
      'avg(span.self_time)': {},
      'avg(http.response_content_length)': {},
      'avg(http.response_transfer_size)': {},
      'avg(http.decoded_response_content_length)': {},
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
  it.each(widgetIds)('can load widget: %s', async (widgetId: string) => {
    render(<ChartWidgetLoader id={widgetId} />);

    // Initially should show loading state from ChartWidgetLoader, it will disappear when dynamic import completes.
    // We only need to check that the dynamic import completes for these tests as that means ChartWidgetLoader is able to load all widgets
    expect(screen.getByTestId('loading-placeholder')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
    });

    expect(TimeSeriesWidgetVisualization).toHaveBeenCalledWith(
      expect.objectContaining({
        id: widgetId,
      }),
      undefined
    );
  });

  it('shows error state for invalid widget id', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    render(<ChartWidgetLoader id="invalid-widget" />);

    await waitFor(() => {
      expect(screen.getByText('Error loading widget')).toBeInTheDocument();
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
