import {
  getQueryFromQueryString,
  getQueryStringFromQuery,
  getOrderByOptions,
} from 'app/views/organizationDiscover/utils';

import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';
import {COLUMNS} from 'app/views/organizationDiscover/data';

const queryString =
  '?aggregations=%5B%5B%22count()%22%2Cnull%2C%22count%22%5D%2C%5B%22uniq%22%2C%22os_build%22%2C%22uniq_os_build%22%5D%5D&conditions=%5B%5D&end=%222018-07-10T01%3A18%3A04%22&fields=%5B%22event_id%22%2C%22timestamp%22%5D&limit=1000&orderby=%22-timestamp%22&projects=%5B8%5D&start=%222018-06-26T01%3A18%3A04%22';

const query = {
  aggregations: [['count()', null, 'count'], ['uniq', 'os_build', 'uniq_os_build']],
  conditions: [],
  end: '2018-07-10T01:18:04',
  fields: ['event_id', 'timestamp'],
  limit: 1000,
  orderby: '-timestamp',
  projects: [8],
  start: '2018-06-26T01:18:04',
};

describe('getQueryFromQueryString()', function() {
  it('returns empty object if empty query string', function() {
    expect(getQueryFromQueryString('')).toEqual({});
  });

  it('handles aggregations', function() {
    expect(getQueryFromQueryString(queryString)).toEqual(query);
  });
});

describe('getQueryStringFromQuery()', function() {
  it('parses query from query string', function() {
    expect(getQueryStringFromQuery(query)).toEqual(queryString);
  });
});

describe('getOrderByOptions()', function() {
  const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
  const queryBuilder = createQueryBuilder({}, organization);

  it('allows ordering by all fields when no aggregations', function() {
    expect(getOrderByOptions(queryBuilder)).toHaveLength(COLUMNS.length * 2);
  });

  it('allows ordering by aggregations with aggregations and no fields', function() {
    queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

    const options = getOrderByOptions(queryBuilder);
    expect(options).toHaveLength(2);
    expect(options).toEqual([
      {label: 'count asc', value: 'count'},
      {label: 'count desc', value: '-count'},
    ]);
  });

  it('allows ordering by aggregations and fields', function() {
    queryBuilder.updateField('fields', ['message']);
    queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

    const options = getOrderByOptions(queryBuilder);
    expect(options).toHaveLength(4);
    expect(options).toEqual([
      {label: 'message asc', value: 'message'},
      {label: 'message desc', value: '-message'},
      {label: 'count asc', value: 'count'},
      {label: 'count desc', value: '-count'},
    ]);
  });
});
