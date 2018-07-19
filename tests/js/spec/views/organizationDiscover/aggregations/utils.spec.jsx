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
    internal: 'topK(10)(message)',
    external: ['topK(10)', 'message', 'topK_10_message'],
  },
  {
    internal: 'avg(retention_days)',
    external: ['avg', 'retention_days', 'avg_retention_days'],
  },
  {
    internal: 'uniq(tags[server_name])',
    external: ['uniq', 'tags[server_name]', 'uniq_tags_server_name'],
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
      expect(isValidAggregation(['count()', 'email', 'count'], COLUMNS)).toEqual(false);
    });

    it('validates topK', function() {
      expect(isValidAggregation(['topK(5)', 'email', 'topK_5_email'], COLUMNS)).toEqual(
        true
      );
      expect(isValidAggregation(['topK()', 'email', 'topK_5_email'], COLUMNS)).toEqual(
        false
      );
      expect(isValidAggregation(['topK(5)', null, 'topK_5_email'], COLUMNS)).toEqual(
        false
      );
    });

    it('validates uniq', function() {
      expect(isValidAggregation(['uniq', 'email', 'uniq_email'], COLUMNS)).toEqual(true);

      expect(isValidAggregation(['uniq', 'mail', 'uniq_mail'], COLUMNS)).toEqual(false);
    });

    it('validates avg', function() {
      expect(
        isValidAggregation(['avg', 'device_battery_level', 'avg_email'], COLUMNS)
      ).toEqual(true);

      expect(isValidAggregation(['avg', 'email', 'avg_email'], COLUMNS)).toEqual(false);
    });
  });
});
