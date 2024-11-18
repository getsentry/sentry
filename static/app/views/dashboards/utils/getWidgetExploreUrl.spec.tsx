import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {getWidgetExploreUrl} from 'sentry/views/dashboards/utils/getWidgetExploreUrl';

describe('getWidgetExploreUrl', () => {
  const organization = OrganizationFixture();
  const selection = PageFiltersFixture();

  it('returns the correct url for table widgets', () => {
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

    const url = getWidgetExploreUrl(widget, selection, organization);

    // Note: for table widgets the mode is set to samples and the fields are propagated
    expect(url).toBe(
      '/traces/?field=span.description&field=avg%28span.duration%29&groupBy=span.description&interval=30m&mode=samples&query=&statsPeriod=14d&visualize=%7B%22yAxes%22%3A%5B%22avg%28span.duration%29%22%5D%7D'
    );
  });

  it('returns the correct url for timeseries widgets', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.AREA,
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

    const url = getWidgetExploreUrl(widget, selection, organization);

    // Note: for line widgets the mode is set to aggregate
    // The chart type is set to 1 for area charts
    expect(url).toBe(
      '/traces/?field=span.description&field=avg%28span.duration%29&groupBy=span.description&interval=30m&mode=aggregate&query=&statsPeriod=14d&visualize=%7B%22yAxes%22%3A%5B%22avg%28span.duration%29%22%5D%2C%22chartType%22%3A%222%22%7D'
    );
  });
});
