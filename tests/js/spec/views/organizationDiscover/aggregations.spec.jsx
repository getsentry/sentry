import {
  getInternal,
  getExternal,
} from 'app/views/organizationDiscover/aggregations/utils';

const aggregationList = [
  {
    internal: 'count',
    external: ['count()', null, 'count'],
  },
  {
    internal: 'uniq_message',
    external: ['uniq', 'message', 'uniq_message'],
  },
  {
    internal: 'topK_10_message',
    external: ['topK(10)', 'message', 'topK_10_message'],
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
});
