import {
  getQueryFromQueryString,
  getQueryStringFromQuery,
} from 'app/views/organizationDiscover/utils';
import _ from "lodash";

const queryString =
  '?aggregations=%5B%5B%22count()%22%2Cnull%2C%22count%22%5D%2C%5B%22topK(5)%22%2C%22os_build%22%2C%22topK_5_os_build%22%5D%5D&conditions=%5B%5D&end=%222018-07-10T01%3A18%3A04%22&fields=%5B%22event_id%22%2C%22timestamp%22%5D&limit=1000&orderby=%22-timestamp%22&projects=%5B8%5D&start=%222018-06-26T01%3A18%3A04%22';

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



  // getLineSeries = (data, groupBy) => {
  //   return _.groupBy(data, dataPoint => {
  //     return dataPoint[groupBy];
  //   });
  // };

const queryData = [
  {
    'exception_stacks.type': 'ZeroDivisionError',
    platform: 'python',
    count: 6,
    time: 1531094400,
  },
  {
    'exception_stacks.type': 'Type Error',
    platform: 'javascript',
    count: 6,
    time: 1531094400,
  },
  {
    'exception_stacks.type': 'Exception',
    platform: 'php',
    count: 6,
    time: 1531094400
  },
  {
    'exception_stacks.type': 'SnubaError',
    platform: 'python',
    count: 14,
    time: 1531094400,
  },
  {
    'exception_stacks.type': 'ZeroDivisionError',
    platform: 'python',
    count: 20,
    time: 1532070000,
  },
  {
    'exception_stacks.type': 'Type Error',
    platform: 'javascript',
    count: 5,
    time: 1532070000,
  },
  {
    'exception_stacks.type': 'Exception',
    platform: 'php',
    count: 8,
    time: 1532070000
  },
  {
    'exception_stacks.type': 'SnubaError',
    platform: 'python',
    count: 30,
    time: 1532070000,
  },




];

const fields = ['platform', 'exception_stacks.type']


function getDataForChart(queryData, groupbyFields) {
  const output = {};
  queryData.forEach(data => {
    const key = groupbyFields.map(field => data[field]).join(',')
    if (key in output) {
      output[key].count.push(data.count)
    } else {
      output[key] = {count: [data.count]}
    }
  })

  return output;
}

describe('getDataForChart()', function() {
  const expectedData = {
    'python,ZeroDivisionError': {count: [6, 20]},
    'python,SnubaError': {count: [14, 30]},
    'javascript,Type Error': {count: [6, 5]},
    'php,Exception': {count: [6,8]},
  };

  expect(getDataForChart(queryData, fields)).toEqual(expectedData)


})