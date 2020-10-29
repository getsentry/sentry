import {mount} from 'sentry-test/enzyme';

import {
  getChartData,
  getChartDataForWidget,
  getChartDataByDay,
  getDisplayValue,
  getDisplayText,
  downloadAsCsv,
} from 'app/views/discover/result/utils';

describe('Utils', function () {
  describe('getChartData()', function () {
    const raw = [
      {count: 2, uniq_id: 1, 'project.id': 5, environment: null},
      {count: 2, uniq_id: 3, 'project.id': 5, environment: 'staging'},
      {count: 2, uniq_id: 4, 'project.id': 5, environment: 'alpha'},
      {count: 6, uniq_id: 10, 'project.id': 5, environment: 'production'},
    ];
    const query = {
      aggregations: [
        ['count()', null, 'count'],
        ['uniq', 'id', 'uniq_id'],
      ],
      fields: ['project.id', 'environment'],
    };

    it('returns chart data', function () {
      const expected = [
        {
          seriesName: 'count',
          data: [
            {value: 2, name: 'project.id 5 environment null'},
            {value: 2, name: 'project.id 5 environment staging'},
            {value: 2, name: 'project.id 5 environment alpha'},
            {value: 6, name: 'project.id 5 environment production'},
          ],
          animation: false,
        },
        {
          seriesName: 'uniq_id',
          data: [
            {value: 1, name: 'project.id 5 environment null'},
            {value: 3, name: 'project.id 5 environment staging'},
            {value: 4, name: 'project.id 5 environment alpha'},
            {value: 10, name: 'project.id 5 environment production'},
          ],
          animation: false,
        },
      ];

      expect(getChartData(raw, query)).toEqual(expected);
    });
  });

  describe('getChartDataForWidget()', function () {
    const raw = [
      {count: 2, uniq_id: 1, 'project.id': 5, environment: null},
      {count: 2, uniq_id: 3, 'project.id': 5, environment: 'staging'},
      {count: 2, uniq_id: 4, 'project.id': 5, environment: 'alpha'},
      {count: 6, uniq_id: 10, 'project.id': 5, environment: 'production'},
    ];
    const query = {
      aggregations: [
        ['count()', null, 'count'],
        ['uniq', 'id', 'uniq_id'],
      ],
      fields: ['project.id', 'environment'],
    };

    it('returns chart data for widgets with percentages', function () {
      const expected = [
        {
          seriesName: 'count',
          data: [
            {value: 2, percentage: 16.67, name: '5, null', fieldValues: [5, null]},
            {
              value: 2,
              percentage: 16.67,
              name: '5, staging',
              fieldValues: [5, 'staging'],
            },
            {value: 2, percentage: 16.67, name: '5, alpha', fieldValues: [5, 'alpha']},
            {
              value: 6,
              percentage: 50,
              name: '5, production',
              fieldValues: [5, 'production'],
            },
          ],
        },
        {
          seriesName: 'uniq_id',
          data: [
            {value: 1, percentage: 5.56, name: '5, null', fieldValues: [5, null]},
            {
              value: 3,
              percentage: 16.67,
              name: '5, staging',
              fieldValues: [5, 'staging'],
            },
            {value: 4, percentage: 22.22, name: '5, alpha', fieldValues: [5, 'alpha']},
            {
              value: 10,
              percentage: 55.56,
              name: '5, production',
              fieldValues: [5, 'production'],
            },
          ],
        },
      ];

      expect(getChartDataForWidget(raw, query, {includePercentages: true})).toEqual(
        expected
      );
    });
  });

  describe('getChartDataByDay()', function () {
    const raw = [
      {
        'error.type': 'Type Error',
        platform: 'javascript',
        count: 5,
        time: 1532070000,
      },
      {
        'error.type': 'Exception',
        platform: 'php',
        count: 8,
        time: 1532070000,
      },
      {
        'error.type': 'SnubaError',
        platform: 'python',
        count: 30,
        time: 1532070000,
      },
      {
        'error.type': 'ZeroDivisionError',
        platform: 'python',
        count: 20,
        time: 1531180800,
      },
      {
        'error.type': 'ZeroDivisionError',
        platform: 'python',
        count: 6,
        time: 1531094400,
      },
      {
        'error.type': 'Type Error',
        platform: 'javascript',
        count: 6,
        time: 1531094400,
      },
      {
        'error.type': 'Exception',
        platform: 'php',
        count: 6,
        time: 1531094400,
      },
      {
        'error.type': 'SnubaError',
        platform: 'python',
        count: 14,
        time: 1531094400,
      },
    ];

    const query = {
      aggregations: [['count()', null, 'count']],
      fields: ['platform', 'error.type'],
    };

    it('returns chart data grouped by day', function () {
      const expected = [
        {
          data: [
            {name: 1531094400000, value: 14},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 30},
          ],
          seriesName: 'python,SnubaError',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 8},
          ],
          seriesName: 'php,Exception',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 5},
          ],
          seriesName: 'javascript,Type Error',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 20},
            {name: 1532070000000, value: 0},
          ],
          seriesName: 'python,ZeroDivisionError',
        },
      ];

      expect(getChartDataByDay(raw, query)).toEqual(expected);
    });

    it('returns chart data with zero filled dates', function () {
      const zeroFilledRaw = [
        {
          'error.type': 'Type Error',
          platform: 'javascript',
          count: 5,
          time: 1531465200,
        },
        {
          'error.type': 'Exception',
          platform: 'php',
          count: 8,
          time: 1531465200,
        },
        {
          'error.type': 'SnubaError',
          platform: 'python',
          count: 30,
          time: 1531465200,
        },
        {time: 1531378800},
        {time: 1531292400},
        ...raw.slice(-5),
      ];

      const expected = [
        {
          data: [
            {name: 1531094400000, value: 14},
            {name: 1531180800000, value: 0},
            {name: 1531292400000, value: 0},
            {name: 1531378800000, value: 0},
            {name: 1531465200000, value: 30},
          ],
          seriesName: 'python,SnubaError',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1531292400000, value: 0},
            {name: 1531378800000, value: 0},
            {name: 1531465200000, value: 8},
          ],
          seriesName: 'php,Exception',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1531292400000, value: 0},
            {name: 1531378800000, value: 0},
            {name: 1531465200000, value: 5},
          ],
          seriesName: 'javascript,Type Error',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 20},
            {name: 1531292400000, value: 0},
            {name: 1531378800000, value: 0},
            {name: 1531465200000, value: 0},
          ],
          seriesName: 'python,ZeroDivisionError',
        },
      ];

      expect(getChartDataByDay(zeroFilledRaw, query)).toEqual(expected);
    });

    it('shows only top 10 series by default', function () {
      expect(
        getChartDataByDay(
          [
            ...raw,
            ...[...new Array(10)].map(() => ({
              'error.type': 'Exception',
              platform: `${Math.random()}`,
              count: 10,
              time: 1532070000,
            })),
          ],
          query
        )
      ).toHaveLength(10);
    });

    it('shows all series', function () {
      expect(
        getChartDataByDay(
          [
            ...raw,
            ...[...new Array(10)].map(() => ({
              'error.type': 'Exception',
              platform: `${Math.random()}`,
              count: 10,
              time: 1532070000,
            })),
          ],
          query,
          {allSeries: true}
        )
      ).toHaveLength(14);
    });

    it('maps field value to label', function () {
      const expected = [
        {
          data: [
            {name: 1531094400000, value: 14},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 30},
          ],
          seriesName: 'SNAKES,SnubaError',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 8},
          ],
          seriesName: 'PHP,Exception',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 0},
            {name: 1532070000000, value: 5},
          ],
          seriesName: 'NOT JAVA,Type Error',
        },
        {
          data: [
            {name: 1531094400000, value: 6},
            {name: 1531180800000, value: 20},
            {name: 1532070000000, value: 0},
          ],
          seriesName: 'SNAKES,ZeroDivisionError',
        },
      ];
      expect(
        getChartDataByDay(raw, query, {
          fieldLabelMap: {python: 'SNAKES', php: 'PHP', javascript: 'NOT JAVA'},
        })
      ).toEqual(expected);
    });
  });

  it('getDisplayValue()', function () {
    const testData = [
      {input: null, expectedText: 'null'},
      {
        input: 'some thing',
        expectedText: '"some thing"',
      },
      {
        input: 12,
        expectedText: '12',
      },
      {
        input: ['one', 'two', 'three'],
        expectedText: '["one","two","three"]',
      },
      {
        input: 1000000,
        expectedText: '1,000,000',
      },
    ];

    testData.forEach(({input, expectedText}) => {
      expect(mount(getDisplayValue(input)).text()).toBe(expectedText);
    });
  });

  it('getTextValue()', function () {
    const testData = [
      {input: null, expectedText: 'null'},
      {
        input: 'some thing',
        expectedText: '"some thing"',
      },
      {
        input: 12,
        expectedText: '12',
      },
      {
        input: ['one', 'two', 'three'],
        expectedText: '["one","two","three"]',
      },
      {
        input: 1000000,
        expectedText: '1,000,000',
      },
    ];

    testData.forEach(({input, expectedText}) => {
      expect(getDisplayText(input)).toBe(expectedText);
    });
  });

  describe('downloadAsCsv()', function () {
    let locationSpy;
    beforeEach(function () {
      locationSpy = jest.spyOn(window.location, 'assign').mockImplementation(_ => _);
    });
    afterEach(function () {
      jest.restoreAllMocks();
    });
    it('handles raw data', function () {
      const result = {
        meta: [{name: 'message'}, {name: 'environment'}],
        data: [
          {message: 'test 1', environment: 'prod'},
          {message: 'test 2', environment: 'test'},
        ],
      };
      downloadAsCsv(result);
      expect(locationSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent('message,environment\r\ntest 1,prod\r\ntest 2,test')
        )
      );
    });
    it('handles aggregations', function () {
      const result = {
        meta: [{type: 'UInt64', name: 'count'}],
        data: [{count: 3}],
      };
      downloadAsCsv(result);
      expect(locationSpy).toHaveBeenCalledWith(
        expect.stringContaining(encodeURI('count\r\n3'))
      );
    });
    it('quotes unsafe strings', function () {
      const result = {
        meta: [{name: 'message'}],
        data: [{message: '=HYPERLINK(http://some-bad-website#)'}],
      };
      downloadAsCsv(result);
      expect(locationSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          encodeURIComponent("message\r\n'=HYPERLINK(http://some-bad-website#)")
        )
      );
    });
  });
});
