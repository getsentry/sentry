import {getDiscoverUrlPathFromDiscoverQuery} from 'app/views/dashboards/utils/getDiscoverUrlPathFromDiscoverQuery';

describe('getDiscoverUrlPathFromDiscoverQuery', function () {
  const organization = TestStubs.Organization();

  it('gets url when grouped by time', function () {
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
    expect(
      getDiscoverUrlPathFromDiscoverQuery({
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
      '/organizations/org-slug/discover/?aggregations=%5B%5B%22uniq%22%2C%22user.email%22%2C%22uniq_user_email%22%5D%5D&conditions=%5B%5B%22user.email%22%2C%22IS%20NOT%20NULL%22%2Cnull%5D%5D&end=null&fields=%5B%5D&limit=1000&orderby=%22-uniq_user_email%22&range=%2214d%22&start=null&visualization=line-by-day'
    );
  });

  it('gets url when not grouped by time', function () {
    const query = {
      name: 'Known Users',
      fields: [],
      conditions: [['user.email', 'IS NOT NULL', null]],
      aggregations: [['uniq', 'user.email', 'Users']],
      limit: 1000,
      orderby: '-Users',
    };
    expect(
      getDiscoverUrlPathFromDiscoverQuery({
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
      '/organizations/org-slug/discover/?aggregations=%5B%5B%22uniq%22%2C%22user.email%22%2C%22uniq_user_email%22%5D%5D&conditions=%5B%5B%22user.email%22%2C%22IS%20NOT%20NULL%22%2Cnull%5D%5D&end=null&fields=%5B%5D&limit=1000&orderby=%22-uniq_user_email%22&range=%2214d%22&start=null&visualization=table'
    );
  });
});
