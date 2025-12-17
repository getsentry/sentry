import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {
  getWidgetExploreUrl,
  getWidgetTableRowExploreUrlFunction,
} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';

describe('getWidgetExploreUrl', () => {
  const organization = OrganizationFixture();
  const selection = PageFiltersFixture();

  it('returns the correct aggregate mode url for table widgets with aggregation', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          fields: ['span.description', 'avg(span.duration)'],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: '',
          orderby: '',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Note: for table widgets the mode is set to samples and the fields are propagated
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['avg(span.duration)']})],
      ],
    });
  });

  it('returns correct URL for widgets with a project selection', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.LOGS,
      queries: [
        WidgetQueryFixture({
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '-count()',
        }),
      ],
    });

    const widgetSelection = PageFiltersFixture({
      projects: [17762],
    });

    const url = getWidgetExploreUrl(widget, undefined, widgetSelection, organization);

    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/logs/',
      params: [
        ['aggregateField', '{"chartType":1,"yAxes":["count()"]}'],
        ['interval', '3h'],
        ['logsGroupBy', ''],
        ['mode', 'aggregate'],
        ['project', '17762'],
        ['statsPeriod', '14d'],
      ],
    });
  });

  it('returns the correct aggregate mode url for table widgets with equations sort', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          fields: ['span.description', 'equation|avg(span.duration) + 100'],
          aggregates: ['equation|avg(span.duration) + 100'],
          columns: ['span.description'],
          conditions: '',
          orderby: '-equation[0]',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Note: for table widgets the mode is set to samples and the fields are propagated
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['statsPeriod', '14d'],
        ['sort', '-equation|avg(span.duration) + 100'],
        [
          'visualize',
          JSON.stringify({chartType: 1, yAxes: ['equation|avg(span.duration) + 100']}),
        ],
      ],
    });
  });

  it('returns the correct samples mode url for table widgets without aggregation', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          fields: ['span.description', 'span.duration'],
          aggregates: [],
          columns: [],
          conditions: '',
          orderby: '',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Note: for table widgets the mode is set to samples and the fields are propagated
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['interval', '30m'],
        ['mode', 'samples'],
        ['statsPeriod', '14d'],
      ],
    });
  });

  it('returns the correct url for timeseries widgets', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.AREA,
      queries: [
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: '',
          orderby: '',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Note: for line widgets the mode is set to aggregate
    // The chart type is set to 1 for area charts
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 2, yAxes: ['avg(span.duration)']})],
      ],
    });
  });

  it('returns the correct url for timeseries widgets without grouping', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.AREA,
      queries: [
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: [],
          conditions: '',
          orderby: '',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Note: for line widgets the mode is set to aggregate
    // The chart type is set to 1 for area charts
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.duration'],
        ['groupBy', ''],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 2, yAxes: ['avg(span.duration)']})],
      ],
    });
  });

  it('returns the correct URL for chart widgets where the sort is not in the yAxes', () => {
    // This is a widget plotting the avg(span.duration) for the most frequented spans
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: '',
          orderby: '-count(span.duration)',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // The URL should have the sort and another visualize to plot the sort
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['sort', '-count(span.duration)'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['avg(span.duration)']})],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['count(span.duration)']})],
      ],
    });
  });

  it('applies the dashboard filters to the query', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: 'span.description:test',
          orderby: '-avg(span.duration)',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(
      widget,
      {
        release: ['1.0.0', '2.0.0'],
      },
      selection,
      organization
    );

    // Assert that the query contains the dashboard filters in its resulting URL
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['query', '(span.description:test) release:["1.0.0","2.0.0"] '],
        ['sort', '-avg(span.duration)'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['avg(span.duration)']})],
      ],
    });
  });

  it('returns the correct url for multiple queries', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          fields: [],
          aggregates: ['count(span.duration)', 'avg(span.duration)'],
          columns: ['span.description'],
          conditions: 'is_transaction:true',
          orderby: '',
          name: '',
        },
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: 'is_transaction:false',
          orderby: '',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(widget, undefined, selection, organization);

    // Provide a fake base URL to allow parsing the relative URL
    const urlObject = new URL(url, 'https://www.example.com');
    expect(urlObject.pathname).toBe('/organizations/org-slug/explore/traces/compare/');

    expect(urlObject.searchParams.get('interval')).toBe('30m');
    expect(urlObject.searchParams.get('title')).toBe('Widget');

    const queries = urlObject.searchParams.getAll('queries');
    expect(queries).toHaveLength(2);

    const query1 = JSON.parse(queries[0]!);
    expect(query1.chartType).toBe(1);
    expect(query1.fields).toEqual([]);
    expect(query1.groupBys).toEqual(['span.description']);
    expect(query1.query).toBe('is_transaction:true');

    const query2 = JSON.parse(queries[1]!);
    expect(query2.chartType).toBe(1);
    expect(query2.fields).toEqual([]);
    expect(query2.groupBys).toEqual(['span.description']);
    expect(query2.query).toBe('is_transaction:false');
  });

  it('adds referrer query parameter if provided', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          fields: [],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: 'span.description:test',
          orderby: '-avg(span.duration)',
          name: '',
        },
      ],
    });

    const url = getWidgetExploreUrl(
      widget,
      {},
      selection,
      organization,
      undefined,
      'test-referrer'
    );

    // Assert that the query contains the dashboard filters in its resulting URL
    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['query', 'span.description:test'],
        ['sort', '-avg(span.duration)'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['avg(span.duration)']})],
        ['referrer', 'test-referrer'],
      ],
    });
  });
});

describe('getWidgetTableRowExploreUrlFunction', () => {
  const organization = OrganizationFixture();
  const selection = PageFiltersFixture();

  it('uses the filter conditions from the widget to generate the trace URL', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          fields: ['browser.name'],
          aggregates: ['avg(span.duration)'],
          columns: ['span.description'],
          conditions: 'span.description:test',
          orderby: '-avg(span.duration)',
          name: '',
        },
      ],
    });

    const urlGenerator = getWidgetTableRowExploreUrlFunction(
      selection,
      widget,
      organization
    );
    const url = urlGenerator({
      'browser.name': 'Chrome',
    });

    expectUrl(url).toMatch({
      path: '/organizations/org-slug/explore/traces/',
      params: [
        ['field', 'browser.name'],
        ['groupBy', 'browser.name'],
        ['interval', '30m'],
        ['mode', 'samples'],
        // span.description:test is carried over from the widget query conditions
        ['query', 'span.description:test browser.name:Chrome'],
        ['referrer', 'api.dashboards.tablewidget.row'],
        ['sort', '-span.duration'],
        ['statsPeriod', '14d'],
        ['visualize', JSON.stringify({chartType: 1, yAxes: ['avg(span.duration)']})],
      ],
    });
  });
});

function expectUrl(url: string) {
  return {
    toMatch({path, params}: {params: Array<[string, string]>; path: string}) {
      expect(url).toMatch(new RegExp(`^${path}\\?`));
      const urlParams = new URLSearchParams(url.substring(path.length));
      function compareFn(a: [string, string], b: [string, string]) {
        if (a[0] < b[0]) {
          return -1;
        }

        if (a[0] > b[0]) {
          return 1;
        }

        return a[1].localeCompare(b[1]);
      }
      expect([...urlParams.entries()].sort(compareFn)).toEqual(
        [...params].sort(compareFn)
      );
    },
  };
}
