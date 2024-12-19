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
      '/organizations/org-slug/traces/?dataset=spansRpc&field=span.description&field=avg%28span.duration%29&groupBy=span.description&interval=30m&mode=samples&statsPeriod=14d&visualize=%7B%22chartType%22%3A1%2C%22yAxes%22%3A%5B%22avg%28span.duration%29%22%5D%7D'
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
      '/organizations/org-slug/traces/?dataset=spansRpc&field=span.description&field=avg%28span.duration%29&groupBy=span.description&interval=30m&mode=aggregate&statsPeriod=14d&visualize=%7B%22chartType%22%3A2%2C%22yAxes%22%3A%5B%22avg%28span.duration%29%22%5D%7D'
    );
  });
});
