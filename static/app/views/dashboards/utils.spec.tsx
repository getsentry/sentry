import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  eventViewFromWidget,
  flattenErrors,
  getCurrentPageFilters,
  getDashboardsMEPQueryParams,
  getFieldsFromEquations,
  getNumEquations,
  getWidgetDiscoverUrl,
  getWidgetIssueUrl,
  hasUnsavedFilterChanges,
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

  describe('getFieldsFromEquations', () => {
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

  describe('getWidgetDiscoverUrl', () => {
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
      const url = getWidgetDiscoverUrl(
        widget,
        undefined,
        selection,
        OrganizationFixture()
      );
      expect(url).toBe(
        '/organizations/org-slug/explore/discover/results/?field=count%28%29&name=Test%20Query&query=&statsPeriod=7d&yAxis=count%28%29'
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
      const url = getWidgetDiscoverUrl(
        widget,
        undefined,
        selection,
        OrganizationFixture()
      );
      expect(url).toBe(
        '/organizations/org-slug/explore/discover/results/?display=top5&field=error.type&field=count%28%29&name=Test%20Query&query=error.unhandled%3Atrue&sort=-count&statsPeriod=7d&yAxis=count%28%29'
      );
    });
    it('applies the dashboard filters to the query', () => {
      widget = {
        ...widget,
        ...{
          displayType: DisplayType.LINE,
          queries: [
            {
              name: '',
              conditions: 'transaction.op:test',
              fields: [],
              aggregates: [],
              columns: [],
              orderby: '',
            },
          ],
        },
      };
      const url = getWidgetDiscoverUrl(
        widget,
        {release: ['1.0.0', '2.0.0']},
        selection,
        OrganizationFixture()
      );
      const queryString = url.split('?')[1];
      const urlParams = new URLSearchParams(queryString);
      expect(urlParams.get('query')).toBe(
        '(transaction.op:test) release:["1.0.0","2.0.0"] '
      );
    });
  });
  describe('getWidgetIssueUrl', () => {
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
      const url = getWidgetIssueUrl(widget, undefined, selection, OrganizationFixture());
      expect(url).toBe(
        '/organizations/org-slug/issues/?query=is%3Aunresolved&sort=date&statsPeriod=7d'
      );
    });
    it('applies the dashboard filters to the query', () => {
      const url = getWidgetIssueUrl(
        widget,
        {release: ['1.0.0', '2.0.0']},
        selection,
        OrganizationFixture()
      );
      const queryString = url.split('?')[1];
      const urlParams = new URLSearchParams(queryString);
      expect(urlParams.get('query')).toBe('(is:unresolved) release:["1.0.0","2.0.0"] ');
    });
  });

  describe('flattenErrors', () => {
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

  describe('getDashboardsMEPQueryParams', () => {
    it('returns correct params if enabled', () => {
      expect(getDashboardsMEPQueryParams(true)).toEqual({
        dataset: 'metricsEnhanced',
      });
    });
    it('returns empty object if disabled', () => {
      expect(getDashboardsMEPQueryParams(false)).toEqual({});
    });
  });

  describe('getNumEquations', () => {
    it('returns 0 if there are no equations', () => {
      expect(getNumEquations(['count()', 'epm()', 'count_unique(user)'])).toBe(0);
    });

    it('returns the count of equations if there are multiple', () => {
      expect(
        getNumEquations([
          'count()',
          'equation|count_unique(user) * 2',
          'count_unique(user)',
          'equation|count_unique(user) * 3',
        ])
      ).toBe(2);
    });

    it('returns 0 if the possible equations array is empty', () => {
      expect(getNumEquations([])).toBe(0);
    });
  });

  describe('hasUnsavedFilterChanges', () => {
    it('ignores the order of projects', () => {
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

    it('ignores the order of environments', () => {
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

    it('ignores the order of releases', () => {
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

describe('getCurrentPageFilters', () => {
  it('returns empty array for environment when not defined in location query', () => {
    const location = LocationFixture({
      query: {
        project: '1',
        statsPeriod: '7d',
      },
    });

    const result = getCurrentPageFilters(location);

    expect(result.environment).toEqual([]);
    expect(result.projects).toEqual([1]);
    expect(result.period).toBe('7d');
  });

  it('returns empty array for environment when environment is undefined', () => {
    const location = LocationFixture({
      query: {
        project: '1',
        environment: undefined,
        statsPeriod: '7d',
      },
    });

    const result = getCurrentPageFilters(location);

    expect(result.environment).toEqual([]);
  });

  it('returns empty array for environment when environment is null', () => {
    const location = LocationFixture({
      query: {
        project: '1',
        environment: null,
        statsPeriod: '7d',
      },
    });

    const result = getCurrentPageFilters(location);

    expect(result.environment).toEqual([]);
  });

  it('converts single environment string to array', () => {
    const location = LocationFixture({
      query: {
        project: '1',
        environment: 'production',
        statsPeriod: '7d',
      },
    });

    const result = getCurrentPageFilters(location);

    expect(result.environment).toEqual(['production']);
  });

  it('preserves environment array when already an array', () => {
    const location = LocationFixture({
      query: {
        project: '1',
        environment: ['production', 'staging'],
        statsPeriod: '7d',
      },
    });

    const result = getCurrentPageFilters(location);

    expect(result.environment).toEqual(['production', 'staging']);
  });
});
