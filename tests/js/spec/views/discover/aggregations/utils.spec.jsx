import {
  getInternal,
  getExternal,
  isValidAggregation,
} from 'app/views/discover/aggregations/utils';
import {COLUMNS} from 'app/views/discover/data';

const aggregationList = [
  {
    internal: 'count',
    external: ['count()', null, 'count'],
  },
  {
    internal: 'uniq(message)',
    external: ['uniq', 'message', 'uniq_message'],
  },
  {
    internal: 'avg(device.battery_level)',
    external: ['avg', 'device.battery_level', 'avg_device_battery_level'],
  },
  {
    internal: 'uniq(server_name)',
    external: ['uniq', 'server_name', 'uniq_server_name'],
  },
  {
    internal: 'uniq(browser.name)',
    external: ['uniq', 'browser.name', 'uniq_browser_name'],
  },
  {
    internal: 'sum(device.battery_level)',
    external: ['sum', 'device.battery_level', 'sum_device_battery_level'],
  },
];

describe('Aggregations', function() {
  describe('converts between internal and external format', function() {
    it('getExternal()', function() {
      aggregationList.forEach(({internal, external}) => {
        expect(getExternal(internal)).toEqual(external);
      });
    });

    it('getInternal()', function() {
      aggregationList.forEach(({internal, external}) => {
        expect(getInternal(external)).toEqual(internal);
      });
    });
  });

  describe('isValidAggregation()', function() {
    it('validates count', function() {
      expect(isValidAggregation(['count()', null, 'count'], COLUMNS)).toEqual(true);
      expect(isValidAggregation(['count', null, 'count'], COLUMNS)).toEqual(false);
      expect(isValidAggregation(['count()', 'user.email', 'count'], COLUMNS)).toEqual(
        false
      );
    });

    it('validates uniq', function() {
      expect(
        isValidAggregation(['uniq', 'user.email', 'uniq_user_email'], COLUMNS)
      ).toEqual(true);

      expect(isValidAggregation(['uniq', 'mail', 'uniq_mail'], COLUMNS)).toEqual(false);
    });

    it('validates avg', function() {
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

    it('validates sum', function() {
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
