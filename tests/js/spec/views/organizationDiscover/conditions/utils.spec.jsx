import {
  getInternal,
  getExternal,
  isValidCondition,
} from 'app/views/organizationDiscover/conditions/utils';

import {COLUMNS} from 'app/views/organizationDiscover/data';

const conditionList = [
  {
    internal: 'message LIKE %test%',
    external: ['message', 'LIKE', '%test%'],
  },
  {
    internal: 'user_id = USER_1',
    external: ['user_id', '=', 'USER_1'],
  },
  {
    internal: 'message IS NOT NULL',
    external: ['message', 'IS NOT NULL', null],
  },
  {
    internal: 'device_battery_level = 3',
    external: ['device_battery_level', '=', 3],
  },
  {
    internal: 'device_battery_level >= 0',
    external: ['device_battery_level', '>=', 0],
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
    internal: 'exception_frames.in_app = true',
    external: ['exception_frames.in_app', '=', true],
  },
];

describe('Conditions', function() {
  it('getExternal()', function() {
    conditionList.forEach(({internal, external}) => {
      expect(getExternal(internal, COLUMNS)).toEqual(external);
    });
  });

  it('getInternal()', function() {
    conditionList.forEach(({internal, external}) => {
      expect(getInternal(external, COLUMNS)).toEqual(internal);
    });
  });

  describe('isValidCondition()', function() {
    it('validates column name exists', function() {
      expect(isValidCondition(['device_name', '=', 'something'], COLUMNS)).toBe(true);
      expect(isValidCondition(['device__name', '=', 'something'], COLUMNS)).toBe(false);
    });

    it('validates column type', function() {
      expect(isValidCondition(['device_battery_level', '=', 5], COLUMNS)).toBe(true);
      expect(isValidCondition(['device_battery_level', '=', '5'], COLUMNS)).toBe(false);
    });

    it('validates operator', function() {
      expect(isValidCondition(['device_name', 'LIKE', '%something%'], COLUMNS)).toBe(
        true
      );
      expect(isValidCondition(['device__name', 'iS', '%something%'], COLUMNS)).toBe(
        false
      );
    });
  });
});
