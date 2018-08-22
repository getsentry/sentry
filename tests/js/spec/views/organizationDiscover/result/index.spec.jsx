import React from 'react';
import {shallow} from 'enzyme';

import Result from 'app/views/organizationDiscover/result';

describe('Result', function() {
  const data = {
    data: [
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
        time: 1531094400,
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
        time: 1531180800,
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
        time: 1532070000,
      },
      {
        'exception_stacks.type': 'SnubaError',
        platform: 'python',
        count: 30,
        time: 1532070000,
      },
    ],
    timing: {
      duration_ms: 5,
    },
  };
  const query = {
    aggregations: [['count()', null, 'count']],
    fields: ['platform', 'exception_stacks.type'],
  };

  const wrapper = shallow(<Result data={data} chartData={data} chartQuery={query} />);

  describe('getChartData()', function() {
    const expectedData = [
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 10th', value: 20},
          {name: 'Jul 20th', value: null},
        ],
        seriesName: 'python,ZeroDivisionError',
      },
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 20th', value: 5},
          {name: 'Jul 10th', value: null},
        ],
        seriesName: 'javascript,Type Error',
      },
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 20th', value: 8},
          {name: 'Jul 10th', value: null},
        ],
        seriesName: 'php,Exception',
      },
      {
        data: [
          {name: 'Jul 9th', value: 14},
          {name: 'Jul 20th', value: 30},
          {name: 'Jul 10th', value: null},
        ],
        seriesName: 'python,SnubaError',
      },
    ];

    it('Gets line chart data correctly', function() {
      expect(wrapper.instance().getChartData(data.data, query.fields)).toEqual(
        expectedData
      );
    });
  });
});
