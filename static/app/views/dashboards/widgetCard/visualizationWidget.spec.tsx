import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {VisualizationWidget} from 'sentry/views/dashboards/widgetCard/visualizationWidget';
import {WidgetCardDataLoader} from 'sentry/views/dashboards/widgetCard/widgetCardDataLoader';

jest.mock('sentry/views/dashboards/widgetCard/widgetCardDataLoader');
jest.mock(
  'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization',
  () => ({
    TimeSeriesWidgetVisualization: jest.fn(
      ({
        plottables,
      }: {
        plottables: Array<{
          name: string;
          thresholds?: {max_values: {max1?: number; max2?: number}};
        }>;
      }) => {
        const thresholdValues = plottables.find(
          plottable => plottable.name === '__thresholds__'
        )?.thresholds?.max_values;

        return (
          <div data-test-id="chart">
            {thresholdValues && (
              <div data-test-id="threshold-values">
                {thresholdValues.max1}, {thresholdValues.max2}
              </div>
            )}
          </div>
        );
      }
    ),
  })
);

const spansBreakdownWidget = {
  title: 'Cache Miss Rate',
  description: '',
  interval: '5m',
  displayType: DisplayType.LINE,
  widgetType: WidgetType.SPANS,
  legendType: 'breakdown' as const,
  queries: [
    {
      name: '',
      conditions: 'span.op:[cache.get,cache.get_item]',
      fields: ['transaction', 'count()'],
      aggregates: ['count()'],
      columns: ['transaction'],
      orderby: '',
    },
  ],
};

const selection = PageFiltersFixture();

// Series name format for a grouped SPANS query: "<groupValue> : <aggregate>"
const timeseriesResults = [
  {
    seriesName: 'my_transaction : count()',
    data: [{name: 1_000_000, value: 10}],
    color: '#000',
  },
];

// tableResults must be non-empty to trigger showBreakdownData
const tableResults = [
  {
    title: '',
    data: [{transaction: 'my_transaction', 'count()': 10}],
    meta: {fields: {transaction: 'string', 'count()': 'integer'}, units: {}},
  },
];

beforeEach(() => {
  PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/stats/',
    body: [],
  });
  jest.mocked(WidgetCardDataLoader).mockImplementation(({children}: any) =>
    children({
      timeseriesResults,
      tableResults,
      loading: false,
      errorMessage: undefined,
      confidence: undefined,
      dataScanned: undefined,
      isSampled: undefined,
      sampleCount: undefined,
    })
  );
});

afterEach(() => {
  PageFiltersStore.reset();
});

describe('VisualizationWidget breakdown series labels', () => {
  it('renders series labels as plain text without visibility-explore-view', () => {
    render(<VisualizationWidget widget={spansBreakdownWidget} selection={selection} />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(screen.queryByRole('link', {name: 'my_transaction'})).not.toBeInTheDocument();
    expect(screen.getByText('my_transaction')).toBeInTheDocument();
  });

  it('renders series labels as explore links with visibility-explore-view', () => {
    render(<VisualizationWidget widget={spansBreakdownWidget} selection={selection} />, {
      organization: OrganizationFixture({features: ['visibility-explore-view']}),
    });

    expect(screen.getByRole('link', {name: 'my_transaction'})).toBeInTheDocument();
  });
});

describe('VisualizationWidget threshold periods', () => {
  const thresholdWidget = {
    ...spansBreakdownWidget,
    thresholds: {
      max_values: {max1: 100, max2: 200},
      unit: null,
      timePeriod: '10m',
    },
  };

  it('updates rendered threshold ranges when the widget interval changes', () => {
    const {rerender} = render(
      <VisualizationWidget
        widget={thresholdWidget}
        selection={selection}
        widgetInterval="10m"
      />,
      {organization: OrganizationFixture()}
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('100, 200');

    rerender(
      <VisualizationWidget
        widget={thresholdWidget}
        selection={selection}
        widgetInterval="1h"
      />
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('600, 1200');
  });

  it('keeps fixed threshold ranges unchanged when the widget interval changes', () => {
    const fixedThresholdWidget = {
      ...thresholdWidget,
      thresholds: {
        max_values: {max1: 100, max2: 200},
        unit: null,
      },
    };
    const {rerender} = render(
      <VisualizationWidget
        widget={fixedThresholdWidget}
        selection={selection}
        widgetInterval="10m"
      />,
      {organization: OrganizationFixture()}
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('100, 200');

    rerender(
      <VisualizationWidget
        widget={fixedThresholdWidget}
        selection={selection}
        widgetInterval="1h"
      />
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('100, 200');
  });
});
