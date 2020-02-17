import {
  getQueryFromQueryString,
  getQueryStringFromQuery,
  queryHasChanged,
  getOrderbyFields,
  parseSavedQuery,
  generateQueryName,
} from 'app/views/discover/utils';
import createQueryBuilder from 'app/views/discover/queryBuilder';
import {COLUMNS} from 'app/views/discover/data';

const queryString =
  '?aggregations=%5B%5B%22count()%22%2Cnull%2C%22count%22%5D%2C%5B%22uniq%22%2C%22os_build%22%2C%22uniq_os_build%22%5D%5D&conditions=%5B%5D&end=%222018-07-10T01%3A18%3A04%22&fields=%5B%22id%22%2C%22timestamp%22%5D&limit=1000&orderby=%22-timestamp%22&projects=%5B8%5D&start=%222018-06-26T01%3A18%3A04%22';

const queryStringWithInvalidKey =
  '?aggregations=%5B%5B%22count()%22%2Cnull%2C%22count%22%5D%2C%5B%22uniq%22%2C%22os_build%22%2C%22uniq_os_build%22%5D%5D&conditions=%5B%5D&end=%222018-07-10T01%3A18%3A04%22&fields=%5B%22id%22%2C%22timestamp%22%5D&limit=1000&orderby=%22-timestamp%22&projects=%5B8%5D&start=%222018-06-26T01%3A18%3A04%22&invalid=true';

const query = {
  aggregations: [
    ['count()', null, 'count'],
    ['uniq', 'os_build', 'uniq_os_build'],
  ],
  conditions: [],
  end: '2018-07-10T01:18:04',
  fields: ['id', 'timestamp'],
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

  it('strips invalid keys', function() {
    expect(getQueryFromQueryString(queryStringWithInvalidKey)).toEqual(query);
  });
});

describe('getQueryStringFromQuery()', function() {
  it('parses query from query string', function() {
    expect(getQueryStringFromQuery(query)).toEqual(queryString);
  });

  it('keeps location in query string if provided', function() {
    expect(getQueryStringFromQuery(query, {visualization: 'table'})).toEqual(
      `${queryString}&visualization=table`
    );
  });
});

describe('queryHasChanged()', function() {
  it('checks only query fields', function() {
    const prev = '?fields=%5B"id"%5D&editing=true';
    const next = '?fields=%5B"id"%5D';

    expect(queryHasChanged(prev, next)).toBe(false);
  });
});

describe('getOrderbyFields()', function() {
  const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
  const queryBuilder = createQueryBuilder({}, organization);

  it('allows ordering by all fields when no aggregations except project.name', function() {
    expect(getOrderbyFields(queryBuilder)).toHaveLength(COLUMNS.length - 1);
  });

  it('allows ordering by aggregations with aggregations and no fields', function() {
    queryBuilder.updateField('fields', []);
    queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

    const options = getOrderbyFields(queryBuilder);
    expect(options).toHaveLength(1);
    expect(options).toEqual([{label: 'count', value: 'count'}]);
  });

  it('allows ordering by aggregations and fields', function() {
    queryBuilder.updateField('fields', ['message']);
    queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

    const options = getOrderbyFields(queryBuilder);
    expect(options).toHaveLength(2);
    expect(options).toEqual([
      {label: 'message', value: 'message'},
      {label: 'count', value: 'count'},
    ]);
  });
});

describe('parseSavedQuery()', function() {
  it('strips metadata', function() {
    const queryFromApi = {
      id: '1',
      name: 'Test query',
      dateCreated: '2018-09-25T00:14:04.914Z',
      dateUpdated: '2018-09-25T00:14:04.914Z',
      fields: [],
      projects: [],
      conditions: [],
      limit: 10,
    };

    expect(parseSavedQuery(queryFromApi)).toEqual({
      fields: [],
      projects: [],
      conditions: [],
      limit: 10,
    });
  });
});

describe('generateQueryName()', function() {
  it('generates name', function() {
    expect(generateQueryName()).toBe('Result - Oct 17 02:41:20');
  });
});
