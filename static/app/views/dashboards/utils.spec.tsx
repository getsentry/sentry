import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  constructWidgetFromQuery,
  eventViewFromWidget,
  flattenErrors,
  getDashboardsMEPQueryParams,
  getFieldsFromEquations,
  getNumEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  hasUnsavedFilterChanges,
  isCustomMeasurementWidget,
  isUsingPerformanceScore,
  isWidgetUsingTransactionName,
} from 'sentry/views/dashboards/utils';

describe('Dashboards util', () => {
  const selection = {
    datetime: {
      period: '7d',
      utc: null,
      start: null,
      end: null,
    },
    environments: [],
    projects: [],
  };
  describe('constructWidgetFromQuery', () => {
    let baseQuery!: NonNullable<Parameters<typeof constructWidgetFromQuery>[0]>;
    beforeEach(() => {
      baseQuery = {
        displayType: 'line',
        interval: '5m',
        queryConditions: ['title:test', 'event.type:test'],
        queryFields: ['count()', 'failure_count()'],
        queryAggregates: ['count()', 'failure_count()'],
        queryColumns: [],
        queryNames: ['1', '2'],
        queryOrderby: '',
        title: 'Widget Title',
      };
    });
    it('returns a widget when given a valid query', () => {
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget?.displayType).toEqual(DisplayType.LINE);
      expect(widget?.interval).toBe('5m');
      expect(widget?.title).toBe('Widget Title');
      expect(widget?.queries).toEqual([
        {
          name: '1',
          fields: ['count()', 'failure_count()'],
          aggregates: ['count()', 'failure_count()'],
          columns: [],
          conditions: 'title:test',
          orderby: '',
        },
        {
          name: '2',
          fields: ['count()', 'failure_count()'],
          aggregates: ['count()', 'failure_count()'],
          columns: [],
          conditions: 'event.type:test',
          orderby: '',
        },
      ]);
      expect(widget?.widgetType).toBe('discover');
    });
    it('returns undefined if query is missing title', () => {
      baseQuery.title = '';
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget).toBeUndefined();
    });
    it('returns undefined if query is missing interval', () => {
      baseQuery.interval = '';
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget).toBeUndefined();
    });
    it('returns undefined if query is missing displayType', () => {
      baseQuery.displayType = '';
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget).toBeUndefined();
    });
    it('returns a widget when given string fields and conditions', () => {
      baseQuery.queryConditions = 'title:test';
      baseQuery.queryFields = 'count()';
      baseQuery.queryAggregates = 'count()';
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget?.displayType).toEqual(DisplayType.LINE);
      expect(widget?.interval).toBe('5m');
      expect(widget?.title).toBe('Widget Title');
      expect(widget?.queries).toEqual([
        {
          name: '1',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: 'title:test',
          orderby: '',
        },
      ]);
    });
  });
  describe('eventViewFromWidget', () => {
    let widget!: Widget;
    beforeEach(() => {
      widget = {
        title: 'Test Query',
        displayType: DisplayType.AREA,
        widgetType: WidgetType.DISCOVER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          },
        ],
      };
    });
    it('handles sorts in function format', () => {
      const query = {...widget.queries[0]!, orderby: '-count()'};
      const eventView = eventViewFromWidget(widget.title, query, selection);
      expect(eventView.fields[0]!.field).toBe('count()');
      expect(eventView.sorts).toEqual([{field: 'count', kind: 'desc'}]);
    });
  });

  describe('getFieldsFromEquations', function () {
    it('returns a list of fields that includes individual terms of provided equations', () => {
      const fields = [
        'equation|(count_if(transaction.duration,greater,300) / count()) * 100',
        'equation|(count_if(transaction.duration,lessOrEquals,300) / count()) * 100',
      ];
      expect(getFieldsFromEquations(fields)).toEqual(
        expect.arrayContaining([
          'count_if(transaction.duration,lessOrEquals,300)',
          'count()',
          'count_if(transaction.duration,greater,300)',
        ])
      );
    });
  });

  describe('getWidgetDiscoverUrl', function () {
    let widget!: Widget;
    beforeEach(() => {
      widget = {
        title: 'Test Query',
        displayType: DisplayType.LINE,
        widgetType: WidgetType.DISCOVER,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: '',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          },
        ],
      };
    });
    it('returns the discover url of the widget query', () => {
      const url = getWidgetDiscoverUrl(widget, selection, OrganizationFixture());
      expect(url).toBe(
        '/organizations/org-slug/discover/results/?field=count%28%29&name=Test%20Query&query=&statsPeriod=7d&yAxis=count%28%29'
      );
    });
    it('returns the discover url of a topn widget query', () => {
      widget = {
        ...widget,
        ...{
          displayType: DisplayType.TOP_N,
          queries: [
            {
              name: '',
              conditions: 'error.unhandled:true',
              fields: ['error.type', 'count()'],
              aggregates: ['count()'],
              columns: ['error.type'],
              orderby: '-count',
            },
          ],
        },
      };
      const url = getWidgetDiscoverUrl(widget, selection, OrganizationFixture());
      expect(url).toBe(
        '/organizations/org-slug/discover/results/?display=top5&field=error.type&field=count%28%29&name=Test%20Query&query=error.unhandled%3Atrue&sort=-count&statsPeriod=7d&yAxis=count%28%29'
      );
    });
  });
  describe('getWidgetIssueUrl', function () {
    let widget!: Widget;
    beforeEach(() => {
      widget = {
        title: 'Test Query',
        displayType: DisplayType.TABLE,
        widgetType: WidgetType.ISSUE,
        interval: '5m',
        queries: [
          {
            name: '',
            conditions: 'is:unresolved',
            fields: ['events'],
            orderby: 'date',
            aggregates: [],
            columns: [],
          },
        ],
      };
    });
    it('returns the issue url of the widget query', () => {
      const url = getWidgetIssueUrl(widget, selection, OrganizationFixture());
      expect(url).toBe(
        '/organizations/org-slug/issues/?query=is%3Aunresolved&sort=date&statsPeriod=7d'
      );
    });
  });

  describe('flattenErrors', function () {
    it('flattens nested errors', () => {
      const errorResponse = {
        widgets: [
          {
            title: ['Ensure this field has no more than 3 characters.'],
          },
        ],
      };
      expect(flattenErrors(errorResponse, {})).toEqual({
        title: 'Ensure this field has no more than 3 characters.',
      });
    });
    it('does not spread error strings', () => {
      const errorResponse = 'Dashboard title already taken.';
      expect(flattenErrors(errorResponse, {})).toEqual({
        error: 'Dashboard title already taken.',
      });
    });
  });

  describe('getDashboardsMEPQueryParams', function () {
    it('returns correct params if enabled', function () {
      expect(getDashboardsMEPQueryParams(true)).toEqual({
        dataset: 'metricsEnhanced',
      });
    });
    it('returns empty object if disabled', function () {
      expect(getDashboardsMEPQueryParams(false)).toEqual({});
    });
  });

  describe('getNumEquations', function () {
    it('returns 0 if there are no equations', function () {
      expect(getNumEquations(['count()', 'epm()', 'count_unique(user)'])).toBe(0);
    });

    it('returns the count of equations if there are multiple', function () {
      expect(
        getNumEquations([
          'count()',
          'equation|count_unique(user) * 2',
          'count_unique(user)',
          'equation|count_unique(user) * 3',
        ])
      ).toBe(2);
    });

    it('returns 0 if the possible equations array is empty', function () {
      expect(getNumEquations([])).toBe(0);
    });
  });

  describe('isCustomMeasurementWidget', function () {
    it('returns false on a non custom measurement widget', function () {
      const widget: Widget = {
        title: 'Title',
        interval: '5m',
        displayType: DisplayType.LINE,
        widgetType: WidgetType.DISCOVER,
        queries: [
          {
            conditions: '',
            fields: [],
            aggregates: ['count()', 'p99(measurements.lcp)'],
            columns: [],
            name: 'widget',
            orderby: '',
          },
        ],
      };
      expect(isCustomMeasurementWidget(widget)).toBe(false);
    });

    it('returns true on a custom measurement widget', function () {
      const widget: Widget = {
        title: 'Title',
        interval: '5m',
        displayType: DisplayType.LINE,
        widgetType: WidgetType.DISCOVER,
        queries: [
          {
            conditions: '',
            fields: [],
            aggregates: ['p99(measurements.custom.measurement)'],
            columns: [],
            name: 'widget',
            orderby: '',
          },
        ],
      };
      expect(isCustomMeasurementWidget(widget)).toBe(true);
    });
  });

  describe('hasUnsavedFilterChanges', function () {
    it('ignores the order of projects', function () {
      const initialDashboard = {
        projects: [1, 2],
      } as DashboardDetails;
      const location = {
        ...LocationFixture(),
        query: {
          project: ['2', '1'],
        },
      };

      expect(hasUnsavedFilterChanges(initialDashboard, location)).toBe(false);
    });

    it('ignores the order of environments', function () {
      const initialDashboard = {
        environment: ['alpha', 'beta'],
      } as DashboardDetails;
      const location = {
        ...LocationFixture(),
        query: {
          environment: ['beta', 'alpha'],
        },
      };

      expect(hasUnsavedFilterChanges(initialDashboard, location)).toBe(false);
    });

    it('ignores the order of releases', function () {
      const initialDashboard = {
        filters: {
          release: ['v1', 'v2'],
        },
      } as DashboardDetails;

      expect(
        hasUnsavedFilterChanges(initialDashboard, {
          ...LocationFixture(),
          query: {
            release: ['v2', 'v1'],
          },
        })
      ).toBe(false);
    });
  });
});

describe('isWidgetUsingTransactionName', () => {
  let baseQuery!: NonNullable<Parameters<typeof constructWidgetFromQuery>[0]>;
  beforeEach(() => {
    baseQuery = {
      displayType: 'line',
      interval: '5m',
      queryConditions: ['title:test', 'event.type:test'],
      queryFields: ['count()', 'failure_count()'],
      queryNames: ['1', '2'],
      queryOrderby: '',
      title: 'Widget Title',
    };
  });

  it('returns false when widget does not use transaction', () => {
    const widget = constructWidgetFromQuery(baseQuery)!;
    expect(isWidgetUsingTransactionName(widget)).toBe(false);
  });

  it('returns true when widget uses transaction as a selected field', () => {
    (baseQuery.queryFields as string[]).push('transaction');
    const widget = constructWidgetFromQuery(baseQuery)!;
    expect(isWidgetUsingTransactionName(widget)).toBe(true);
  });

  it('returns true when widget uses transaction as part of the query filter', () => {
    baseQuery.queryConditions = ['transaction:test'];
    const widget = constructWidgetFromQuery(baseQuery)!;
    expect(isWidgetUsingTransactionName(widget)).toBe(true);
  });

  describe('isUsingPerformanceScore', () => {
    it('returns false when widget does not use performance_score', () => {
      const widget = constructWidgetFromQuery(baseQuery)!;
      expect(isUsingPerformanceScore(widget)).toBe(false);
    });

    it('returns true when widget uses performance_score as aggregate', () => {
      (baseQuery.queryFields as string[]).push(
        'performance_score(measurements.score.total)'
      );
      const widget = constructWidgetFromQuery(baseQuery)!;
      expect(isUsingPerformanceScore(widget)).toBe(true);
    });

    it('returns true when widget uses performance_score as condition', () => {
      (baseQuery.queryConditions as string[]).push(
        'performance_score(measurements.score.total):>0.5'
      );
      const widget = constructWidgetFromQuery(baseQuery)!;
      expect(isUsingPerformanceScore(widget)).toBe(true);
    });
  });
});
