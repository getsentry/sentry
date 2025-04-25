// eslint-disable-next-line import/no-nodejs-modules
import fs from 'node:fs';
// eslint-disable-next-line import/no-nodejs-modules
import path from 'node:path';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ChartWidgetLoader} from './chartWidgetLoader';

// Mock this component so it doesn't yell at us for no plottables
jest.mock(
  'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization',
  () => {
    function TimeSeriesWidgetVisualization() {
      return null;
    }
    TimeSeriesWidgetVisualization.LoadingPlaceholder = function () {
      return <div />;
    };
    return {
      TimeSeriesWidgetVisualization,
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
    series: [],
    isPending: false,
    isError: false,
  })),
}));
jest.mock('sentry/views/insights/sessions/queries/useNewAndResolvedIssues', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    series: [],
    isPending: false,
    isError: false,
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
  beforeAll(() => {
    jest.unmock('@tanstack/react-query');
  });

  beforeEach(() => {
    // Mock API responses
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: {
        data: [[123, []]],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [123, [{count: 1}]],
          [124, [{count: 2}]],
        ],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: {
        groups: [],
        intervals: [],
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-metrics/',
      body: {
        data: [],
        meta: {
          fields: {
            'count()': 'integer',
          },
        },
      },
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/undefined/issues/',
      body: [],
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
