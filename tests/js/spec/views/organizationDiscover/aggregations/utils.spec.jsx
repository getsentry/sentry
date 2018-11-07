import {
  getInternal,
  getExternal,
  isValidAggregation,
} from 'app/views/organizationDiscover/aggregations/utils';

import {COLUMNS} from 'app/views/organizationDiscover/data';

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
    internal: 'uniq(tags[server_name])',
    external: ['uniq', 'tags[server_name]', 'uniq_tags_server_name'],
  },
  {
    internal: 'uniq(tags[browser.name])',
    external: ['uniq', 'tags[browser.name]', 'uniq_tags_browser_name'],
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
  });
});
