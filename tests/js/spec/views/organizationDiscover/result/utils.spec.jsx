import {
  getChartData,
  getChartDataByDay,
} from 'app/views/organizationDiscover/result/utils';

describe('Utils', function() {
  it('getChartData()', function() {
    const raw = [
      {count: 2, uniq_event_id: 1, project_id: 5, 'tags[environment]': null},
      {count: 2, uniq_event_id: 3, project_id: 5, 'tags[environment]': 'staging'},
      {count: 2, uniq_event_id: 4, project_id: 5, 'tags[environment]': 'alpha'},
      {count: 6, uniq_event_id: 10, project_id: 5, 'tags[environment]': 'production'},
    ];

    const query = {
      aggregations: [['count()', null, 'count'], ['uniq', 'event_id', 'uniq_event_id']],
      fields: ['project_id', 'tags[environment]'],
    };

    const expected = [
      {
        seriesName: 'count',
        data: [
          {value: 2, name: 'project_id 5 tags[environment] null'},
          {value: 2, name: 'project_id 5 tags[environment] staging'},
          {value: 2, name: 'project_id 5 tags[environment] alpha'},
          {value: 6, name: 'project_id 5 tags[environment] production'},
        ],
      },
      {
        seriesName: 'uniq_event_id',
        data: [
          {value: 1, name: 'project_id 5 tags[environment] null'},
          {value: 3, name: 'project_id 5 tags[environment] staging'},
          {value: 4, name: 'project_id 5 tags[environment] alpha'},
          {value: 10, name: 'project_id 5 tags[environment] production'},
        ],
      },
    ];

    expect(getChartData(raw, query)).toEqual(expected);
  });

  it('getChartDataByDay()', function() {
    const raw = [
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
    ];

    const query = {
      aggregations: [['count()', null, 'count']],
      fields: ['platform', 'exception_stacks.type'],
    };

    const expected = [
      {
        data: [
          {name: 'Jul 9th', value: 14},
          {name: 'Jul 10th', value: null},
          {name: 'Jul 20th', value: 30},
        ],
        seriesName: 'python,SnubaError',
      },
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 10th', value: null},
          {name: 'Jul 20th', value: 8},
        ],
        seriesName: 'php,Exception',
      },
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 10th', value: null},
          {name: 'Jul 20th', value: 5},
        ],
        seriesName: 'javascript,Type Error',
      },
      {
        data: [
          {name: 'Jul 9th', value: 6},
          {name: 'Jul 10th', value: 20},
          {name: 'Jul 20th', value: null},
        ],
        seriesName: 'python,ZeroDivisionError',
      },
    ];

    expect(getChartDataByDay(raw, query)).toEqual(expected);
  });
});
