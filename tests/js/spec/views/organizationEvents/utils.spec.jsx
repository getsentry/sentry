import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {getParams} from 'app/views/organizationEvents/utils';

describe('OrganizationEvents utils', function() {
  describe('getParams', function() {
    it('has a default `statsPeriod` by default', function() {
      expect(getParams()).toEqual({
        statsPeriod: DEFAULT_STATS_PERIOD,
      });
    });

    it('transforms `period` parameter to `statsPeriod`', function() {
      expect(getParams({period: '24h'})).toEqual({
        statsPeriod: '24h',
      });
    });

    it('can be passed `statsPeriod` instead of `period`', function() {
      expect(
        getParams({
          statsPeriod: '24h',
        })
      ).toEqual({
        statsPeriod: '24h',
      });
    });

    it('prefers `statsPeriod` over `period`', function() {
      expect(
        getParams({
          statsPeriod: '24h',
          period: '2h',
        })
      ).toEqual({
        statsPeriod: '24h',
      });
    });

    it('only returns `statsPeriod` if absolute range is supplied as well', function() {
      // NOTE: This is an arbitrary decision, change as needed
      expect(getParams({start: 'start', end: 'end', period: '24h'})).toEqual({
        statsPeriod: '24h',
      });
    });

    it('does not change other parameters', function() {
      expect(getParams({foo: 'bar', period: '24h'})).toEqual({
        foo: 'bar',
        statsPeriod: '24h',
      });
    });

    it('filters out only null and undefined, values', function() {
      expect(
        getParams({
          foo: null,
          bar: 0,
          start: null,
          period: '24h',
        })
      ).toEqual({
        bar: 0,
        statsPeriod: '24h',
      });
    });
  });
});
