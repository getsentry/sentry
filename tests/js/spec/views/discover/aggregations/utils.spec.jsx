import {isValidAggregation} from 'app/views/discover/aggregations/utils';
import {COLUMNS} from 'app/views/discover/data';

describe('Aggregations', function () {
  describe('isValidAggregation()', function () {
    it('validates count', function () {
      expect(isValidAggregation(['count()', null, 'count'], COLUMNS)).toEqual(true);
      expect(isValidAggregation(['count', null, 'count'], COLUMNS)).toEqual(false);
      expect(isValidAggregation(['count()', 'user.email', 'count'], COLUMNS)).toEqual(
        false
      );
    });

    it('validates uniq', function () {
      expect(
        isValidAggregation(['uniq', 'user.email', 'uniq_user_email'], COLUMNS)
      ).toEqual(true);

      expect(isValidAggregation(['uniq', 'mail', 'uniq_mail'], COLUMNS)).toEqual(false);
    });

    it('validates avg', function () {
      expect(
        isValidAggregation(
          ['avg', 'device.battery_level', 'avg_device_battery_level'],
          COLUMNS
        )
      ).toEqual(true);

      expect(
        isValidAggregation(['avg', 'user.email', 'avg_user_email'], COLUMNS)
      ).toEqual(false);
    });

    it('validates sum', function () {
      expect(
        isValidAggregation(
          ['sum', 'device.battery_level', 'sum_device_battery_level'],
          COLUMNS
        )
      ).toEqual(true);

      expect(
        isValidAggregation(['sum', 'user.email', 'sum_user_email'], COLUMNS)
      ).toEqual(false);
    });
  });
});
