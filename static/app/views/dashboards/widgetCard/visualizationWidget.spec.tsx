import {Fragment, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetTimeSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {SpanFields} from 'sentry/views/insights/types';

import {VisualizationWidget} from './visualizationWidget';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

jest.mock('sentry/views/dashboards/widgetCard/widgetCardDataLoader');
jest.mock(
  'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization',
  () => ({
    TimeSeriesWidgetVisualization: Object.assign(
      jest.fn(
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
      {LoadingPlaceholder: () => <div data-test-id="loading-placeholder" />}
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

function makeResult(
  yAxis: string,
  groupBy: Array<{key: string; value: string}>,
  value: number
): WidgetTimeSeries {
  const groupName = groupBy.map(group => group.value).join(',');
  return {
    queryIndex: 0,
    widgetQuery: spansBreakdownWidget.queries[0]!,
    // Series name format for a grouped query: "<groupValue> : <aggregate>"
    seriesName: `${groupName} : ${yAxis}`,
    timeSeries: {
      yAxis,
      groupBy,
      values: [{timestamp: 1_000_000, value}],
      meta: {interval: 300_000, valueType: 'integer', valueUnit: null},
    },
  };
}

const timeseriesResults = [
  makeResult('count()', [{key: 'transaction', value: 'my_transaction'}], 10),
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
  it('renders series labels as Explore links', () => {
    render(<VisualizationWidget widget={spansBreakdownWidget} selection={selection} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getByRole('link', {name: 'my_transaction'})).toBeInTheDocument();
  });

  it('keeps the other group by values next to the model name', () => {
    const modelWidget = {
      ...spansBreakdownWidget,
      queries: [
        {
          ...spansBreakdownWidget.queries[0]!,
          fields: [SpanFields.GEN_AI_REQUEST_MODEL, 'gen_ai.generation.error', 'count()'],
          columns: [SpanFields.GEN_AI_REQUEST_MODEL, 'gen_ai.generation.error'],
        },
      ],
    };
    jest.mocked(WidgetCardDataLoader).mockImplementation(({children}: any) =>
      children({
        timeseriesResults: [
          makeResult(
            'count()',
            [
              {key: SpanFields.GEN_AI_REQUEST_MODEL, value: 'gemini-3.7-flash'},
              {key: 'gen_ai.generation.error', value: 'timed out'},
            ],
            4
          ),
          makeResult(
            'count()',
            [
              {key: SpanFields.GEN_AI_REQUEST_MODEL, value: 'gemini-3.7-flash'},
              {key: 'gen_ai.generation.error', value: 'connection refused'},
            ],
            1
          ),
        ],
        tableResults: [
          {
            title: '',
            data: [
              {
                [SpanFields.GEN_AI_REQUEST_MODEL]: 'gemini-3.7-flash',
                'gen_ai.generation.error': 'timed out',
                'count()': 4,
              },
              {
                [SpanFields.GEN_AI_REQUEST_MODEL]: 'gemini-3.7-flash',
                'gen_ai.generation.error': 'connection refused',
                'count()': 1,
              },
            ],
            meta: {fields: {}, units: {}},
          },
        ],
        loading: false,
      })
    );

    render(<VisualizationWidget widget={modelWidget} selection={selection} />, {
      organization: OrganizationFixture(),
    });

    expect(screen.getAllByText('gemini-3.7-flash')).toHaveLength(2);
    expect(screen.getByText(',timed out')).toBeInTheDocument();
    expect(screen.getByText(',connection refused')).toBeInTheDocument();

    // Explore links filter on every group by value, not just the model
    const link = screen.getByRole('link', {name: /timed out/});
    const query = new URLSearchParams(link.getAttribute('href')!.split('?')[1]).get(
      'query'
    );
    expect(query).toContain('gen_ai.request.model:gemini-3.7-flash');
    expect(query).toContain('gen_ai.generation.error:"timed out"');
  });
});

describe('VisualizationWidget memoization', () => {
  function EditableWidget() {
    const [widget, setWidget] = useState(spansBreakdownWidget);
    return (
      <Fragment>
        <Button onClick={() => setWidget(w => ({...w, title: `${w.title}!`}))}>
          Rename
        </Button>
        <Button onClick={() => setWidget(w => ({...w, displayType: DisplayType.AREA}))}>
          Change type
        </Button>
        <VisualizationWidget widget={widget} selection={selection} />
      </Fragment>
    );
  }

  it('does not re-render the chart when only the title changes', async () => {
    render(<EditableWidget />, {organization: OrganizationFixture()});

    // Let the releases request settle so its re-render isn't counted below
    await waitFor(() => expect(TimeSeriesWidgetVisualization).toHaveBeenCalledTimes(2));
    jest.mocked(TimeSeriesWidgetVisualization).mockClear();

    await userEvent.click(screen.getByRole('button', {name: 'Rename'}));
    expect(TimeSeriesWidgetVisualization).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', {name: 'Change type'}));
    expect(TimeSeriesWidgetVisualization).toHaveBeenCalled();
  });
});

describe('VisualizationWidget threshold time windows', () => {
  const thresholdWidget = {
    ...spansBreakdownWidget,
    thresholds: {
      max_values: {max1: 100, max2: 200},
      unit: null,
      timeWindow: '10m',
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

  it('scales release thresholds using the interval requested for the series', () => {
    const releaseWidget = {
      ...thresholdWidget,
      widgetType: WidgetType.RELEASE,
      queries: [
        {
          ...thresholdWidget.queries[0]!,
          fields: ['release', 'sum(session)'],
          aggregates: ['sum(session)'],
          columns: ['release'],
          conditions: '',
          orderby: '-release',
        },
      ],
      thresholds: {
        max_values: {max1: 100, max2: 200},
        unit: null,
        timeWindow: '1h',
      },
    };
    jest.mocked(WidgetCardDataLoader).mockImplementationOnce(({children}: any) =>
      children({
        timeseriesResults: [
          makeResult('sum(session)', [{key: 'release', value: 'v1'}], 10),
        ],
        timeseriesInterval: '1h',
        loading: false,
      })
    );

    render(
      <VisualizationWidget
        widget={releaseWidget}
        selection={PageFiltersFixture({
          datetime: {...selection.datetime, period: '14d'},
        })}
        widgetInterval="3h"
      />,
      {organization: OrganizationFixture()}
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('100, 200');
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

  it('treats a saved interval as fixed for unsupported aggregates', () => {
    const durationWidget = {
      ...thresholdWidget,
      queries: [
        {
          ...thresholdWidget.queries[0]!,
          aggregates: [`p95(${SpanFields.SPAN_DURATION})`],
        },
      ],
    };

    render(
      <VisualizationWidget
        widget={durationWidget}
        selection={selection}
        widgetInterval="1h"
      />,
      {organization: OrganizationFixture()}
    );

    expect(screen.getByTestId('threshold-values')).toHaveTextContent('100, 200');
  });

  it.each([`sum(${SpanFields.SPAN_DURATION})`, 'equation|count() / 2'])(
    'scales a saved interval for %s',
    aggregate => {
      const widget = {
        ...thresholdWidget,
        queries: [{...thresholdWidget.queries[0]!, aggregates: [aggregate]}],
      };

      render(
        <VisualizationWidget widget={widget} selection={selection} widgetInterval="1h" />,
        {organization: OrganizationFixture()}
      );

      expect(screen.getByTestId('threshold-values')).toHaveTextContent('600, 1200');
    }
  );
});

describe('VisualizationWidget dropped-data heatmap', () => {
  const orgWithFlags = () =>
    OrganizationFixture({
      features: [
        'explore-data-fidelity-annotations',
        'dashboards-data-fidelity-annotations',
      ],
    });

  let droppedDataRequest: jest.Mock;

  beforeEach(() => {
    jest.mocked(TimeSeriesWidgetVisualization).mockClear();
    droppedDataRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-dropped/',
      body: {
        droppedEvents: [OutcomeRowFixture({count: 10})],
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 90})],
        meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      },
    });
  });

  function lastDroppedDataProp() {
    const calls = jest.mocked(TimeSeriesWidgetVisualization).mock.calls;
    return calls.at(-1)![0].droppedData;
  }

  it('passes the band to the chart', async () => {
    render(
      <VisualizationWidget
        widget={spansBreakdownWidget}
        selection={selection}
        widgetInterval="5m"
      />,
      {organization: orgWithFlags()}
    );

    await waitFor(() =>
      expect(lastDroppedDataProp()).toEqual(
        expect.objectContaining({dataset: DiscoverDatasets.SPANS})
      )
    );
  });

  it('waits for the band before drawing the chart', async () => {
    let resolveDroppedData!: () => void;
    const asyncDelay = new Promise<void>(resolve => {
      resolveDroppedData = resolve;
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-dropped/',
      body: {
        droppedEvents: [OutcomeRowFixture({count: 10})],
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 90})],
        meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
      },
      asyncDelay,
    });

    render(
      <VisualizationWidget
        widget={spansBreakdownWidget}
        selection={selection}
        widgetInterval="5m"
      />,
      {organization: orgWithFlags()}
    );

    expect(await screen.findByTestId('loading-placeholder')).toBeInTheDocument();
    expect(TimeSeriesWidgetVisualization).not.toHaveBeenCalled();

    await act(async () => {
      resolveDroppedData();
      await asyncDelay;
    });

    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(
      jest.mocked(TimeSeriesWidgetVisualization).mock.calls[0]![0].droppedData
    ).toEqual(expect.objectContaining({dataset: DiscoverDatasets.SPANS}));
  });

  it('hides the heatmap while editing a widget (disableFullscreen)', async () => {
    render(
      <VisualizationWidget
        widget={spansBreakdownWidget}
        selection={selection}
        widgetInterval="5m"
        disableFullscreen
      />,
      {organization: orgWithFlags()}
    );

    await waitFor(() => expect(droppedDataRequest).toHaveBeenCalled());
    expect(lastDroppedDataProp()).toBeUndefined();
  });

  it('does not request dropped data for unsupported widget types', async () => {
    render(
      <VisualizationWidget
        widget={{...spansBreakdownWidget, widgetType: WidgetType.TRANSACTIONS}}
        selection={selection}
        widgetInterval="5m"
      />,
      {organization: orgWithFlags()}
    );

    await waitFor(() => expect(TimeSeriesWidgetVisualization).toHaveBeenCalled());
    expect(droppedDataRequest).not.toHaveBeenCalled();
    expect(lastDroppedDataProp()).toBeUndefined();
  });
});

describe('VisualizationWidget releases', () => {
  let releasesRequest: jest.Mock;

  beforeEach(() => {
    jest.mocked(TimeSeriesWidgetVisualization).mockClear();
    releasesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
  });

  function lastShowReleaseAsProp() {
    const calls = jest.mocked(TimeSeriesWidgetVisualization).mock.calls;
    return calls.at(-1)![0].showReleaseAs;
  }

  it('shows release bubbles', async () => {
    render(
      <VisualizationWidget
        widget={spansBreakdownWidget}
        selection={selection}
        widgetInterval="5m"
      />
    );

    await waitFor(() => expect(releasesRequest).toHaveBeenCalled());
    expect(lastShowReleaseAsProp()).toBe('bubble');
  });

  it('hides releases for mobile builds widgets', async () => {
    render(
      <VisualizationWidget
        widget={{...spansBreakdownWidget, widgetType: WidgetType.PREPROD_APP_SIZE}}
        selection={selection}
        widgetInterval="5m"
      />
    );

    await waitFor(() => expect(TimeSeriesWidgetVisualization).toHaveBeenCalled());
    expect(releasesRequest).not.toHaveBeenCalled();
    expect(lastShowReleaseAsProp()).toBe('none');
  });
});
