import {
  setDateToTime,
  intervalToMilliseconds,
  parsePeriodToHours,
  use24Hours,
  getTimeFormat,
} from 'app/utils/dates';
import ConfigStore from 'app/stores/configStore';

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

    it('handle invalid statsPeriod', function() {
      expect(parsePeriodToHours('24')).toBe(24 / 3600);
      expect(parsePeriodToHours('')).toBe(-1);
      expect(parsePeriodToHours('24x')).toBe(-1);
    });
  });

  describe('user clock preferences', function() {
    afterEach(function() {
      ConfigStore.set('user', TestStubs.User({}));
    });

    describe('use24Hours()', function() {
      it('returns false if user preference is 12 hour clock', function() {
        const user = TestStubs.User();
        user.options.clock24Hours = false;
        ConfigStore.set('user', user);
        expect(use24Hours()).toBe(false);
      });

      it('returns true if user preference is 24 hour clock', function() {
        const user = TestStubs.User();
        user.options.clock24Hours = true;
        ConfigStore.set('user', user);
        expect(use24Hours()).toBe(true);
      });
    });

    describe('getTimeFormat()', function() {
      it('does not use AM/PM if use24Hours is true', function() {
        const user = TestStubs.User();
        user.options.clock24Hours = true;
        ConfigStore.set('user', user);
        expect(getTimeFormat()).toBe('HH:mm');
      });
      it('uses AM/PM if use24Hours is false', function() {
        const user = TestStubs.User();
        user.options.clock24Hours = false;
        ConfigStore.set('user', user);
        expect(getTimeFormat()).toBe('LT');
      });
    });
  });
});
