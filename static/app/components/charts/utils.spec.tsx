import {
  canIncludePreviousPeriod,
  getDiffInMinutes,
  getInterval,
  getSeriesApiInterval,
  GranularityLadder,
  lightenHexToRgb,
  THIRTY_DAYS,
  TWENTY_FOUR_HOURS,
} from 'sentry/components/charts/utils';

describe('Chart Utils', () => {
  describe('getInterval()', () => {
    describe('with high fidelity', () => {
      it('greater than 24 hours', () => {
        expect(getInterval({period: '25h'}, 'high')).toBe('30m');
      });

      it('less than 30 minutes', () => {
        expect(getInterval({period: '20m'}, 'high')).toBe('1m');
      });
      it('between 30 minutes and 24 hours', () => {
        expect(getInterval({period: '12h'}, 'high')).toBe('5m');
      });
      it('more than 14 days', () => {
        expect(getInterval({period: '14d'}, 'high')).toBe('30m');
      });
      it('more than 30 days', () => {
        expect(getInterval({period: '30d'}, 'high')).toBe('1h');
      });
      it('more than 60 days', () => {
        expect(getInterval({period: '90d'}, 'high')).toBe('4h');
      });
    });

    describe('with medium fidelity', () => {
      it('greater than 24 hours', () => {
        expect(getInterval({period: '25h'})).toBe('1h');
        expect(getInterval({period: '25h'}, 'medium')).toBe('1h');
      });

      it('less than 30 minutes', () => {
        expect(getInterval({period: '20m'})).toBe('5m');
        expect(getInterval({period: '20m'}, 'medium')).toBe('5m');
      });
      it('between 30 minutes and 24 hours', () => {
        expect(getInterval({period: '12h'})).toBe('15m');
        expect(getInterval({period: '12h'}, 'medium')).toBe('15m');
      });
      it('more than 14 days', () => {
        expect(getInterval({period: '14d'})).toBe('1h');
        expect(getInterval({period: '14d'}, 'medium')).toBe('1h');
      });
      it('more than 30 days', () => {
        expect(getInterval({period: '30d'})).toBe('4h');
        expect(getInterval({period: '30d'}, 'medium')).toBe('4h');
      });
      it('more than 90 days', () => {
        expect(getInterval({period: '90d'})).toBe('1d');
        expect(getInterval({period: '90d'}, 'medium')).toBe('1d');
      });
    });

    describe('with low fidelity', () => {
      it('greater than 24 hours', () => {
        expect(getInterval({period: '25h'}, 'low')).toBe('6h');
      });

      it('less than 30 minutes', () => {
        expect(getInterval({period: '20m'}, 'low')).toBe('10m');
      });
      it('between 30 minutes and 24 hours', () => {
        expect(getInterval({period: '12h'}, 'low')).toBe('1h');
      });
      it('more than 14 days', () => {
        expect(getInterval({period: '14d'}, 'low')).toBe('12h');
      });
      it('more than 30 days', () => {
        expect(getInterval({period: '30d'}, 'low')).toBe('1d');
      });
      it('more than 90 days', () => {
        expect(getInterval({period: '90d'}, 'low')).toBe('2d');
      });
    });
  });

  describe('getUsageInterval', () => {
    it('calculates intervals for a period', () => {
      expect(getSeriesApiInterval({period: '90d'})).toBe('1d');
      expect(getSeriesApiInterval({period: '60d'})).toBe('1d');

      expect(getSeriesApiInterval({period: '59d'})).toBe('4h');
      expect(getSeriesApiInterval({period: '30d'})).toBe('4h');

      expect(getSeriesApiInterval({period: '29d'})).toBe('1h');
      expect(getSeriesApiInterval({period: '7h'})).toBe('1h');
      expect(getSeriesApiInterval({period: '6h'})).toBe('1h');

      expect(getSeriesApiInterval({period: '3h'})).toBe('5m');
      expect(getSeriesApiInterval({period: '1h'})).toBe('5m');
    });
  });

  describe('findGranularityIntervalForMinutes()', () => {
    const ladder = new GranularityLadder([
      [THIRTY_DAYS, '1d'],
      [TWENTY_FOUR_HOURS, '30m'],
      [0, '15m'],
    ]);

    it('handles negative intervals', () => {
      expect(ladder.getInterval(-1)).toBe('15m');
    });

    it('finds granularity at lower bound', () => {
      expect(ladder.getInterval(getDiffInMinutes({period: '2m'}))).toBe('15m');
    });

    it('finds granularity between bounds', () => {
      expect(ladder.getInterval(getDiffInMinutes({period: '3d'}))).toBe('30m');
    });

    it('finds granularity at upper bound', () => {
      expect(ladder.getInterval(getDiffInMinutes({period: '60d'}))).toBe('1d');
    });
  });

  describe('getDiffInMinutes()', () => {
    describe('with period string', () => {
      it('can parse a period string in seconds', () => {
        expect(getDiffInMinutes({period: '30s'})).toBe(0.5);
      });
      it('can parse a period string in minutes', () => {
        expect(getDiffInMinutes({period: '15m'})).toBe(15);
      });
      it('can parse a period string in hours', () => {
        expect(getDiffInMinutes({period: '1h'})).toBe(60);
      });
      it('can parse a period string in days', () => {
        expect(getDiffInMinutes({period: '5d'})).toBe(7200);
      });
      it('can parse a period string in weeks', () => {
        expect(getDiffInMinutes({period: '1w'})).toBe(10080);
      });
      it('can parse a period string with an upsell suffix', () => {
        expect(getDiffInMinutes({period: '90d-trial'})).toBe(129600);
      });
    });

    // This uses moment so we probably don't need to test it too extensively
    describe('with absolute dates', () => {});
  });

  describe('canIncludePreviousPeriod()', () => {
    it('does not include if `includePrevious` is false', () => {
      expect(canIncludePreviousPeriod(false, '7d')).toBe(false);
    });

    it('is true if period is less than or equal to 45 days', () => {
      expect(canIncludePreviousPeriod(true, '45d')).toBe(true);
    });

    it('is false if period is greater than 45d', () => {
      expect(canIncludePreviousPeriod(true, '46d')).toBe(false);
    });

    it('returns value of `includePrevious` if no period', () => {
      expect(canIncludePreviousPeriod(true, null)).toBe(true);
      expect(canIncludePreviousPeriod(false, null)).toBe(false);
    });
  });

  describe('lightenHexToRgb', () => {
    it('converts hex to rgb and lightens values', () => {
      expect(lightenHexToRgb(['#2f2936', '#f0f0f0'])).toEqual([
        'rgb(77, 71, 84)',
        'rgb(255, 255, 255)',
      ]);
    });
  });
});
