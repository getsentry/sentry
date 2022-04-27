import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  constructWidgetFromQuery,
  eventViewFromWidget,
  flattenErrors,
  getDashboardsMEPQueryParams,
  getFieldsFromEquations,
  getNumEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
} from 'sentry/views/dashboardsV2/utils';

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
    let baseQuery;
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
      expect(widget?.interval).toEqual('5m');
      expect(widget?.title).toEqual('Widget Title');
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
      expect(widget?.widgetType).toEqual('discover');
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
      expect(widget?.interval).toEqual('5m');
      expect(widget?.title).toEqual('Widget Title');
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
    let widget;
    beforeEach(() => {
      widget = {
        title: 'Test Query',
        displayType: DisplayType.WORLD_MAP,
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
    it('attaches a geo.country_code condition and field to a World Map widget if it does not already have one', () => {
      const eventView = eventViewFromWidget(
        widget.title,
        widget.queries[0],
        selection,
        widget.displayType
      );
      expect(eventView.fields[0].field).toEqual('geo.country_code');
      expect(eventView.fields[1].field).toEqual('count()');
      expect(eventView.query).toEqual('has:geo.country_code');
    });
    it('does not attach geo.country_code condition and field to a World Map widget if it already has one', () => {
      widget.queries.fields = ['geo.country_code', 'count()'];
      widget.conditions = 'has:geo.country_code';
      const eventView = eventViewFromWidget(
        widget.title,
        widget.queries[0],
        selection,
        widget.displayType
      );
      expect(eventView.fields[0].field).toEqual('geo.country_code');
      expect(eventView.fields[1].field).toEqual('count()');
      expect(eventView.query).toEqual('has:geo.country_code');
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
    let widget;
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
      const url = getWidgetDiscoverUrl(widget, selection, TestStubs.Organization());
      expect(url).toEqual(
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
      const url = getWidgetDiscoverUrl(widget, selection, TestStubs.Organization());
      expect(url).toEqual(
        '/organizations/org-slug/discover/results/?display=top5&field=error.type&field=count%28%29&name=Test%20Query&query=error.unhandled%3Atrue&sort=-count&statsPeriod=7d&yAxis=count%28%29'
      );
    });
  });
  describe('getWidgetIssueUrl', function () {
    let widget;
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
          },
        ],
      };
    });
    it('returns the issue url of the widget query', () => {
      const url = getWidgetIssueUrl(widget, selection, TestStubs.Organization());
      expect(url).toEqual(
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
});
