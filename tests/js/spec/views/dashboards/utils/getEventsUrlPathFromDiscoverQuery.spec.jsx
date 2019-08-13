import {getEventsUrlPathFromDiscoverQuery} from 'app/views/dashboards/utils/getEventsUrlPathFromDiscoverQuery';

describe('getEventsUrlPathFromDiscoverQuery', function() {
  const organization = TestStubs.Organization();
  const query = {
    name: 'Known Users',
    projects: [1],
    fields: [],
    conditions: [['user.email', 'IS NOT NULL', null]],
    aggregations: [['uniq', 'user.email', 'Known Users']],
    limit: 1000,

    orderby: '-time',
    groupby: ['time'],
    rollup: 86400,
  };

  it('handles nulls in selection', function() {
    expect(
      getEventsUrlPathFromDiscoverQuery({
        organization,
        selection: {
          datetime: {
            start: null,
            end: null,
            period: '14d',
          },
        },
        query,
      })
    ).toBe(
      '/organizations/org-slug/events/?query=%21user.email%3A%22%22&statsPeriod=14d'
    );
  });

  it('has right absolute dates', function() {
    expect(
      getEventsUrlPathFromDiscoverQuery({
        organization,
        selection: {
          datetime: {
            start: new Date(),
            end: new Date(),
          },
        },
        query,
        values: [null, 'iPhone X'],
      })
    ).toBe(
      '/organizations/org-slug/events/?end=2017-10-17T02%3A41%3A20&query=%21user.email%3A%22%22&start=2017-10-17T02%3A41%3A20'
    );
  });

  it('has projects', function() {
    expect(
      getEventsUrlPathFromDiscoverQuery({
        organization,
        selection: {
          projects: [1],
          datetime: {start: null, end: null, period: '14d'},
        },
        query,
      })
    ).toBe(
      '/organizations/org-slug/events/?project=1&query=%21user.email%3A%22%22&statsPeriod=14d'
    );
  });
});
