import {
  getInternal,
  getExternal,
  isValidCondition,
  ignoreCase,
} from 'app/views/discover/conditions/utils';
import {COLUMNS} from 'app/views/discover/data';

const conditionList = [
  {
    internal: 'message LIKE %test%',
    external: ['message', 'LIKE', '%test%'],
  },
  {
    internal: 'user.id = USER_1',
    external: ['user.id', '=', 'USER_1'],
  },
  {
    internal: 'message IS NOT NULL',
    external: ['message', 'IS NOT NULL', null],
  },
  {
    internal: 'device.battery_level = 3',
    external: ['device.battery_level', '=', 3],
  },
  {
    internal: 'device.battery_level >= 0',
    external: ['device.battery_level', '>=', 0],
  },
  {
    internal: 'message NOT LIKE something%',
    external: ['message', 'NOT LIKE', 'something%'],
  },
  {
    internal: 'message LIKE',
    external: ['message', 'LIKE', null],
  },
  {
    internal: 'stack.in_app = true',
    external: ['stack.in_app', '=', true],
  },
  {
    internal: 'stack.in_app = false',
    external: ['stack.in_app', '=', false],
  },
];

describe('Conditions', function () {
  it('getExternal()', function () {
    conditionList.forEach(({internal, external}) => {
      expect(getExternal(internal, COLUMNS)).toEqual(external);
    });

    // datetime fields are expanded
    const expectedTimestamp = ['timestamp', '=', '2018-05-05T00:00:00'];
    expect(getExternal('timestamp = 2018-05-05', COLUMNS)).toEqual(expectedTimestamp);
  });

  it('getInternal()', function () {
    conditionList.forEach(({internal, external}) => {
      expect(getInternal(external, COLUMNS)).toEqual(internal);
    });
  });

  describe('isValidCondition()', function () {
    it('validates column name exists', function () {
      expect(isValidCondition(['device.name', '=', 'something'], COLUMNS)).toBe(true);
      expect(isValidCondition(['device_name', '=', 'something'], COLUMNS)).toBe(false);
    });

    it('validates column type', function () {
      expect(isValidCondition(['device.battery_level', '=', 5], COLUMNS)).toBe(true);
      expect(isValidCondition(['device.battery_level', '=', '5'], COLUMNS)).toBe(false);
    });

    it('validates operator', function () {
      expect(isValidCondition(['device.name', 'LIKE', '%something%'], COLUMNS)).toBe(
        true
      );
      expect(isValidCondition(['device_name', 'iS', '%something%'], COLUMNS)).toBe(false);
    });
  });

  describe('ignoreCase()', function () {
    const conditionCases = [
      {
        input: '',
        output: '',
      },
      {
        input: 'id like %test%',
        output: 'id LIKE %test%',
      },
      {
        input: 'id IS Nul',
        output: 'id IS NUL',
      },
      {
        input: 'id = asdf',
        output: 'id = asdf',
      },
      {
        input: 'id IS not null',
        output: 'id IS NOT NULL',
      },
    ];

    it('uppercases condition operators', function () {
      conditionCases.forEach(({input, output}) => {
        expect(ignoreCase(input)).toBe(output);
      });
    });
  });
});
