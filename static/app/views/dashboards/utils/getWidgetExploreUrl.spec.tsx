import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {getWidgetExploreUrl} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';

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
      path: '/organizations/org-slug/traces/',
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
      path: '/organizations/org-slug/traces/',
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
      path: '/organizations/org-slug/traces/',
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
      path: '/organizations/org-slug/traces/',
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
      path: '/organizations/org-slug/traces/',
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
      path: '/organizations/org-slug/traces/',
      params: [
        ['field', 'span.description'],
        ['field', 'span.duration'],
        ['groupBy', 'span.description'],
        ['interval', '30m'],
        ['mode', 'aggregate'],
        ['query', '(span.description:test) release:\[\"1.0.0\",\"2.0.0\"\] '],
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
