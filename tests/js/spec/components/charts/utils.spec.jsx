import {
  canIncludePreviousPeriod,
  getInterval,
  getDiffInMinutes,
} from 'app/components/charts/utils';

describe('Chart Utils', function () {
  describe('getInterval()', function () {
    describe('with high fidelity', function () {
      it('greater than 24 hours', function () {
        expect(getInterval({period: '25h'}, true)).toBe('30m');
      });

      it('less than 30 minutes', function () {
        expect(getInterval({period: '20m'}, true)).toBe('1m');
      });
      it('between 30 minutes and 24 hours', function () {
        expect(getInterval({period: '12h'}, true)).toBe('5m');
      });
    });

    describe('with low fidelity', function () {
      it('greater than 24 hours', function () {
        expect(getInterval({period: '25h'})).toBe('24h');
      });

      it('less than 30 minutes', function () {
        expect(getInterval({period: '20m'})).toBe('5m');
      });
      it('between 30 minutes and 24 hours', function () {
        expect(getInterval({period: '12h'})).toBe('15m');
      });
    });
  });

  describe('getDiffInMinutes()', function () {
    describe('with period string', function () {
      it('can parse a period string in seconds', function () {
        expect(getDiffInMinutes({period: '30s'})).toBe(0.5);
      });
      it('can parse a period string in minutes', function () {
        expect(getDiffInMinutes({period: '15m'})).toBe(15);
      });
      it('can parse a period string in hours', function () {
        expect(getDiffInMinutes({period: '1h'})).toBe(60);
      });
      it('can parse a period string in days', function () {
        expect(getDiffInMinutes({period: '5d'})).toBe(7200);
      });
      it('can parse a period string in weeks', function () {
        expect(getDiffInMinutes({period: '1w'})).toBe(10080);
      });
    });

    // This uses moment so we probably don't need to test it too extensively
    describe('with absolute dates', function () {});
  });

  describe('canIncludePreviousPeriod()', function () {
    it('does not include if `includePrevious` is false', function () {
      expect(canIncludePreviousPeriod(false, '7d')).toBe(false);
    });

    it('is true if period is less than or equal to 45 days', function () {
      expect(canIncludePreviousPeriod(true, '45d')).toBe(true);
    });

    it('is false if period is greater than 45d', function () {
      expect(canIncludePreviousPeriod(true, '46d')).toBe(false);
    });

    it('returns value of `includePrevious` if no period', function () {
      expect(canIncludePreviousPeriod(true)).toBe(true);
      expect(canIncludePreviousPeriod(false)).toBe(false);
    });
  });
});
