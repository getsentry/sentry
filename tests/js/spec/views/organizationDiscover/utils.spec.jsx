import {
  getQueryFromQueryString,
  getQueryStringFromQuery,
} from 'app/views/organizationDiscover/utils';

const queryString =
  '?aggregations=%5B%5B%22count()%22%2Cnull%2C%22count%22%5D%2C%5B%22topK(5)%22%2C%22os_build%22%2C%22topK_5_os_build%22%5D%5D&conditions=%5B%5D&end=%222018-07-10T01%3A18%3A04%22&fields=%5B%22event_id%22%2C%22timestamp%22%5D&limit=1000&orderby=%22-timestamp%22&projects=%5B8%5D&start=%222018-06-26T01%3A18%3A04%22&';

const query = {
  aggregations: [['count()', null, 'count'], ['topK(5)', 'os_build', 'topK_5_os_build']],
  conditions: [],
  end: '2018-07-10T01:18:04',
  fields: ['event_id', 'timestamp'],
  limit: 1000,
  orderby: '-timestamp',
  projects: [8],
  start: '2018-06-26T01:18:04',
};

describe('get query from URL query string', function() {
  it('returns empty object if empty query string', function() {
    expect(getQueryFromQueryString('')).toEqual({});
  });

  it('handles aggregations', function() {
    expect(getQueryFromQueryString(queryString)).toEqual(query);
  });
});

describe('get query URL string from query', function() {
  it('parses query from query string', function() {
    expect(getQueryStringFromQuery(query)).toEqual(queryString);
  });
});
