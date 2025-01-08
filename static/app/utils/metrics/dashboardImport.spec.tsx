import {OrganizationFixture} from 'sentry-fixture/organization';

import type {MetricMeta, MRI} from 'sentry/types/metrics';
import type {ImportDashboard, ImportWidget} from 'sentry/utils/metrics/dashboardImport';
import {parseDashboard, WidgetParser} from 'sentry/utils/metrics/dashboardImport';
import {parseMRI} from 'sentry/utils/metrics/mri';

const mockRequests = (queryStrings: string[], overrideFormulas: any[] = []) => {
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
      formulas: [...formulas, ...overrideFormulas],
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
  return mris.map(mri => ({
    ...parseMRI(mri),
    mri,
    operations: [],
    blockingStatus: [],
    projectIds: [],
  })) as MetricMeta[];
};

describe('WidgetParser', () => {
  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/metrics/tags/',
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
    const widgetToImport = mockWidget();

    const result = new WidgetParser(
      widgetToImport,
      availableMetrics,
      'test-org',
      false
    ).parse();
    const {report, widget} = await result;

    expect(report.outcome).toBe('success');
    expect(report.errors).toEqual([]);

    expect(widget).toBeDefined();
    expect(widget).toEqual({
      displayType: 'line',
      limit: 10,
      queries: [
        {
          fields: ['sum(c:custom/sentry.foo.bar@none)'],
          aggregates: ['sum(c:custom/sentry.foo.bar@none)'],
          conditions: 'foo:bar',
          columns: ['baz'],
          name: '',
          orderby: undefined,
        },
      ],
      title: 'Test widget',
      widgetType: 'custom-metrics',
    });
  });

  it('should parse a widget with 2 timeseries', async () => {
    const widgetToImport = mockWidget({
      requests: mockRequests([
        'sum:sentry.foo.bar{foo:bar} by {baz}',
        'sum:sentry.bar.baz{}',
      ]),
    });
    const result = new WidgetParser(
      widgetToImport,
      availableMetrics,
      'test-org',
      false
    ).parse();
    const {report, widget} = await result;

    expect(report.outcome).toBe('success');
    expect(report.errors).toEqual([]);

    expect(widget?.queries).toHaveLength(2);

    expect(widget).toEqual({
      title: 'Test widget',
      displayType: 'line',
      widgetType: 'custom-metrics',
      limit: 10,
      queries: [
        {
          name: '',
          aggregates: ['sum(c:custom/sentry.foo.bar@none)'],
          columns: ['baz'],
          fields: ['sum(c:custom/sentry.foo.bar@none)'],
          conditions: 'foo:bar',
          orderby: undefined,
        },
        {
          name: '',
          aggregates: ['sum(c:custom/sentry.bar.baz@none)'],
          columns: [],
          fields: ['sum(c:custom/sentry.bar.baz@none)'],
          conditions: '',
          orderby: undefined,
        },
      ],
    });
  });

  it('should parse a widget with operation appended to metric name', async () => {
    const widgetToImport = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar.avg{foo:bar} by {baz}']),
    });

    const result = new WidgetParser(
      widgetToImport,
      availableMetrics,
      'test-org',
      false
    ).parse();
    const {report, widget} = await result;

    expect(report.outcome).toBe('success');
    expect(widget).toEqual({
      displayType: 'line',
      limit: 10,
      queries: [
        {
          fields: ['avg(c:custom/sentry.foo.bar@none)'],
          aggregates: ['avg(c:custom/sentry.foo.bar@none)'],
          conditions: 'foo:bar',
          columns: ['baz'],
          name: '',
          orderby: undefined,
        },
      ],
      title: 'Test widget',
      widgetType: 'custom-metrics',
    });
  });

  it('should fail to parse widget with unknown metric', async () => {
    const widgetToImport = mockWidget({
      requests: mockRequests(['sum:sentry.unknown-metric{foo:bar} by {baz}']),
    });

    const result = new WidgetParser(
      widgetToImport,
      availableMetrics,
      'test-org',
      false
    ).parse();
    const {report} = await result;

    expect(report.outcome).toBe('error');
    expect(report.errors).toEqual([
      'widget - no parseable queries found',
      'widget.request.query - metric not found: sentry.unknown-metric',
    ]);
  });

  it('should remove unknown tag', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar{not-a-tag:bar} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics, 'test-org', false).parse();
    const {report} = await result;

    expect(report.outcome).toBe('warning');
    expect(report.errors).toEqual([
      'widget.request.query - unsupported filter: not-a-tag',
    ]);
  });

  it('should strip globs form tags', async () => {
    const widget = mockWidget({
      requests: mockRequests(['sum:sentry.foo.bar{foo:bar*} by {baz}']),
    });

    const result = new WidgetParser(widget, availableMetrics, 'test-org', false).parse();
    const {report} = await result;

    expect(report.outcome).toBe('warning');
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
      url: '/organizations/test-org/metrics/tags/',
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

    const result = await parseDashboard(
      dashboard,
      availableMetrics,
      OrganizationFixture({slug: 'test-org'})
    );
    const {report, widgets} = result;

    expect(report).toHaveLength(2);
    expect(report[0]!.outcome).toBe('success');
    expect(widgets).toHaveLength(2);
  });

  it('should parse a dashboard and explode widgets', async () => {
    const dashboard = {
      id: 1,
      title: 'Test dashboard',
      description: 'Test description',
      widgets: [
        mockWidget(),
        mockWidget({
          title: 'Test widget 2',
          legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
          type: 'timeseries',
          requests: mockRequests(['sum:sentry.bar.baz{}', 'sum:sentry.foo.bar{}']),
        }),
      ],
    } as ImportDashboard;

    const result = await parseDashboard(
      dashboard,
      availableMetrics,
      OrganizationFixture({slug: 'test-org'})
    );
    const {report, widgets} = result;

    expect(report).toHaveLength(2);
    expect(report[0]!.outcome).toBe('success');
    expect(widgets).toHaveLength(2);
  });

  it('should parse a dashboard with formulas', async () => {
    const dashboard = {
      id: 1,
      title: 'Test dashboard',
      description: 'Test description',
      widgets: [
        mockWidget({
          title: 'Formula Test widget 2',
          legend_columns: ['avg', 'min', 'max', 'value', 'sum'],
          type: 'timeseries',
          requests: mockRequests(
            ['sum:sentry.bar.baz{}', 'sum:sentry.foo.bar{}'],
            [
              {formula: '2 * query1'},
              {formula: 'query0 + query1'},
              {formula: '(query1 + query1) - query0'},
            ]
          ),
        }),
      ],
    } as ImportDashboard;

    const result = await parseDashboard(
      dashboard,
      availableMetrics,
      OrganizationFixture({slug: 'test-org'})
    );

    const {report, widgets} = result;
    expect(report).toHaveLength(1);
    expect(widgets).toHaveLength(1);

    const queries = widgets[0]!.queries;
    expect(queries).toHaveLength(5);
    expect(queries[2]!.aggregates[0]).toBe('equation|2 * $b');
    expect(queries[3]!.aggregates[0]).toBe('equation|$a + $b');
    expect(queries[4]!.aggregates[0]).toBe('equation|($b + $b) - $a');
  });
});
