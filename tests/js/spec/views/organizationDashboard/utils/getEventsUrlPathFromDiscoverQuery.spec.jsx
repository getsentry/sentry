import {getEventsUrlPathFromDiscoverQuery} from 'app/views/organizationDashboard/utils/getEventsUrlPathFromDiscoverQuery';

describe('getEventsUrlPathFromDiscoverQuery', function() {
  const organization = TestStubs.Organization();
  const query = {
    name: 'Known Users',
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
});
