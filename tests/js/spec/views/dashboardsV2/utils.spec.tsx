import {DisplayType} from 'sentry/views/dashboardsV2/types';
import {constructWidgetFromQuery} from 'sentry/views/dashboardsV2/utils';

describe('Dashboards util', () => {
  describe('constructWidgetFromQuery', () => {
    let baseQuery;
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
    it('returns a widget when given a valid query', () => {
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget?.displayType).toEqual(DisplayType.LINE);
      expect(widget?.interval).toEqual('5m');
      expect(widget?.title).toEqual('Widget Title');
      expect(widget?.queries).toEqual([
        {
          name: '1',
          fields: ['count()', 'failure_count()'],
          conditions: 'title:test',
          orderby: '',
        },
        {
          name: '2',
          fields: ['count()', 'failure_count()'],
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
      const widget = constructWidgetFromQuery(baseQuery);
      expect(widget?.displayType).toEqual(DisplayType.LINE);
      expect(widget?.interval).toEqual('5m');
      expect(widget?.title).toEqual('Widget Title');
      expect(widget?.queries).toEqual([
        {
          name: '1',
          fields: ['count()'],
          conditions: 'title:test',
          orderby: '',
        },
      ]);
    });
  });
});
