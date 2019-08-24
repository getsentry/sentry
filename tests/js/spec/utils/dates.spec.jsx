import {setDateToTime, intervalToMilliseconds, parsePeriodToHours} from 'app/utils/dates';

describe('utils.dates', function() {
  describe('setDateToTime', function() {
    it('can set new time for current date', function() {
      const date = new Date();
      const newDate = setDateToTime(date, '11:11');
      expect(newDate).toEqual(new Date(1508238680000));
    });

    it('can set new time (including seconds) for current date', function() {
      const date = new Date();
      const newDate = setDateToTime(date, '11:11:11');
      expect(newDate).toEqual(new Date(1508238671000));
    });

    it('can set new time in local for current date', function() {
      const date = new Date();
      const newDate = setDateToTime(date, '11:11:11', {local: true});
      expect(newDate).toEqual(new Date(1508166671000));
    });
  });

  describe('intervalToMilliseconds()', function() {
    it('can convert standard formats', function() {
      expect(intervalToMilliseconds('24h')).toBe(86400000);
      expect(intervalToMilliseconds('30m')).toBe(1800000);
      expect(intervalToMilliseconds('15m')).toBe(900000);
      expect(intervalToMilliseconds('5m')).toBe(300000);
      expect(intervalToMilliseconds('1m')).toBe(60000);
    });

    it('can convert arbitrary formats', function() {
      expect(intervalToMilliseconds('1h')).toBe(3600000);
      expect(intervalToMilliseconds('2m')).toBe(120000);
    });
  });

  describe('parsePeriodToHours()', function() {
    it('can convert standard formats', function() {
      expect(parsePeriodToHours('30s').toFixed(4)).toBe('0.0083');
      expect(parsePeriodToHours('1m').toFixed(4)).toBe('0.0167');
      expect(parsePeriodToHours('1h')).toBe(1);
      expect(parsePeriodToHours('24h')).toBe(24);
      expect(parsePeriodToHours('1d')).toBe(24);
      expect(parsePeriodToHours('2w')).toBe(336);
    });
  });
});
