import {MetricMeta, MRI} from 'sentry/types';
import {
  ImportDashboard,
  ImportWidget,
  parseDashboard,
  WidgetParser,
} from 'sentry/utils/metrics/dashboardImport';
import {parseMRI} from 'sentry/utils/metrics/mri';

const mockRequests = (queryStrings: string[]) => {
  const queries = queryStrings.map((queryStr, i) => {
    return {
      data_source: 'metrics',
      name: `query${i}`,
      query: queryStr,
    };
  });
  const formulas = queries.map(query => {
    return {
      formula: query.name,
    };
  });

  return [
    {
      formulas,
      queries,
      response_format: 'timeseries',
      style: {line_type: 'solid'},
      display_type: 'line',
    },
  ];
};

const mockWidget = (overrides = {}) => {
  return {
    id: 1,
    definition: {
      title: 'Test widget',
      legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
      type: 'timeseries',
      requests: mockRequests(['sum:sentry.foo.bar{foo:bar} by {baz}']),
      ...overrides,
    },
  } as ImportWidget;
};

const mockAvailableMetrics = (mris: MRI[]): MetricMeta[] => {
  return mris.map(mri => ({...parseMRI(mri), mri, operations: []})) as MetricMeta[];
};

describe('WidgetParser', () => {
  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/sentry/metrics/tags/',
      method: 'GET',
      body: [
        {key: 'foo', name: 'foo'},
        {key: 'bar', name: 'bar'},
        {key: 'baz', name: 'baz'},
      ],
    });
  });

  const availableMetrics = mockAvailableMetrics([
    'c:custom/sentry.foo.bar@none',
    'c:custom/sentry.bar.baz@none',
  ]);

  it('should parse a widget with single timeseries', async () => {
    const widget = mockWidget();

    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report, widgets} = await result;

    expect(report.outcome).toEqual('success');
    expect(report.errors).toEqual([]);

    expect(widgets).toHaveLength(1);
    expect(widgets[0]).toEqual({
      displayType: 'line',
      groupBy: ['baz'],
      mri: 'c:custom/sentry.foo.bar@none',
      op: 'sum',
      query: 'foo:bar',
      title: 'Test widget',
    });
  });

  it('should parse a widget with 2 timeseries', async () => {
    const widget = mockWidget({
      requests: mockRequests([
        'sum:sentry.foo.bar{foo:bar} by {baz}',
        'sum:sentry.bar.baz{}',
      ]),
    });
    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report, widgets} = await result;

    expect(report.outcome).toEqual('warning');
    expect(report.errors).toEqual([]);
    expect(report.notes.length).toEqual(1);

    expect(widgets).toHaveLength(2);
    expect(widgets[0]).toEqual({
      displayType: 'line',
      groupBy: ['baz'],
      mri: 'c:custom/sentry.foo.bar@none',
      op: 'sum',
      query: 'foo:bar',
      title: 'Test widget',
    });
    expect(widgets[1]).toEqual({
      displayType: 'line',
      groupBy: [],
      mri: 'c:custom/sentry.bar.baz@none',
      op: 'sum',
      query: '',
      title: 'Test widget',
    });
  });

  it('should parse a widget with operation appended to metric name', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar.avg{foo:bar} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report, widgets} = await result;

    expect(report.outcome).toEqual('success');
    expect(widgets[0]).toEqual({
      displayType: 'line',
      groupBy: ['baz'],
      mri: 'c:custom/sentry.foo.bar@none',
      op: 'avg',
      query: 'foo:bar',
      title: 'Test widget',
    });
  });

  it('should fail to parse widget with unknown metric', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.unknown-metric{foo:bar} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report} = await result;

    expect(report.outcome).toEqual('error');
    expect(report.errors).toEqual([
      'widget - no queries found',
      'widget.request.query - metric not found: sentry.unknown-metric',
    ]);
  });

  it('should remove unknown tag', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar{not-a-tag:bar} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report} = await result;

    expect(report.outcome).toEqual('warning');
    expect(report.errors).toEqual([
      'widget.request.query - unsupported filter: not-a-tag',
    ]);
  });

  it('should strip globs form tags', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar{foo:bar*} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics).parse();
    const {report} = await result;

    expect(report.outcome).toEqual('warning');
    expect(report.errors).toEqual([
      'widget.request.query.filter - unsupported value: bar*, using bar',
    ]);
  });
});

describe('parseDashboard', () => {
  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/sentry/metrics/tags/',
      method: 'GET',
      body: [
        {key: 'foo', name: 'foo'},
        {key: 'bar', name: 'bar'},
        {key: 'baz', name: 'baz'},
      ],
    });
  });

  const availableMetrics = mockAvailableMetrics([
    'c:custom/sentry.foo.bar@none',
    'c:custom/sentry.bar.baz@none',
  ]);

  it('should parse a dashboard with single widget', async () => {
    const dashboard = {
      id: 1,
      title: 'Test dashboard',
      description: 'Test description',
      widgets: [mockWidget(), mockWidget()],
    } as ImportDashboard;

    const result = await parseDashboard(dashboard, availableMetrics);
    const {report, widgets} = result;

    expect(report.length).toEqual(2);
    expect(report[0].outcome).toEqual('success');
    expect(widgets.length).toEqual(2);
  });

  it('should parse a dashboard and explode widgets', async () => {
    const dashboard = {
      id: 1,
      title: 'Test dashboard',
      description: 'Test description',
      widgets: [
        mockWidget(),
        mockWidget({
          definition: {
            title: 'Test widget 2',
            legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
            type: 'timeseries',
            requests: mockRequests(['sum:sentry.bar.baz{}', 'sum:sentry.foo.bar{}']),
          },
        }),
      ],
    } as ImportDashboard;

    const result = await parseDashboard(dashboard, availableMetrics);
    const {report, widgets} = result;

    expect(report.length).toEqual(2);
    expect(report[0].outcome).toEqual('success');
    expect(widgets.length).toEqual(2);
  });
});
