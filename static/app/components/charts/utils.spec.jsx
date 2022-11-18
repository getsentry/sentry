import {
  canIncludePreviousPeriod,
  getDiffInMinutes,
  getInterval,
  getSeriesApiInterval,
  lightenHexToRgb,
  processTableResults,
} from 'sentry/components/charts/utils';

describe('Chart Utils', function () {
  describe('getInterval()', function () {
    describe('with high fidelity', function () {
      it('greater than 24 hours', function () {
        expect(getInterval({period: '25h'}, 'high')).toBe('30m');
      });

      it('less than 30 minutes', function () {
        expect(getInterval({period: '20m'}, 'high')).toBe('1m');
      });
      it('between 30 minutes and 24 hours', function () {
        expect(getInterval({period: '12h'}, 'high')).toBe('5m');
      });
      it('more than 14 days', function () {
        expect(getInterval({period: '14d'}, 'high')).toBe('30m');
      });
      it('more than 30 days', function () {
        expect(getInterval({period: '30d'}, 'high')).toBe('1h');
      });
      it('more than 60 days', function () {
        expect(getInterval({period: '90d'}, 'high')).toBe('4h');
      });
    });

    describe('with medium fidelity', function () {
      it('greater than 24 hours', function () {
        expect(getInterval({period: '25h'})).toBe('1h');
        expect(getInterval({period: '25h'}, 'medium')).toBe('1h');
      });

      it('less than 30 minutes', function () {
        expect(getInterval({period: '20m'})).toBe('5m');
        expect(getInterval({period: '20m'}, 'medium')).toBe('5m');
      });
      it('between 30 minutes and 24 hours', function () {
        expect(getInterval({period: '12h'})).toBe('15m');
        expect(getInterval({period: '12h'}, 'medium')).toBe('15m');
      });
      it('more than 14 days', function () {
        expect(getInterval({period: '14d'})).toBe('1h');
        expect(getInterval({period: '14d'}, 'medium')).toBe('1h');
      });
      it('more than 30 days', function () {
        expect(getInterval({period: '30d'})).toBe('4h');
        expect(getInterval({period: '30d'}, 'medium')).toBe('4h');
      });
      it('more than 90 days', function () {
        expect(getInterval({period: '90d'})).toBe('1d');
        expect(getInterval({period: '90d'}, 'medium')).toBe('1d');
      });
    });

    describe('with low fidelity', function () {
      it('greater than 24 hours', function () {
        expect(getInterval({period: '25h'}, 'low')).toBe('6h');
      });

      it('less than 30 minutes', function () {
        expect(getInterval({period: '20m'}, 'low')).toBe('10m');
      });
      it('between 30 minutes and 24 hours', function () {
        expect(getInterval({period: '12h'}, 'low')).toBe('1h');
      });
      it('more than 14 days', function () {
        expect(getInterval({period: '14d'}, 'low')).toBe('12h');
      });
      it('more than 30 days', function () {
        expect(getInterval({period: '30d'}, 'low')).toBe('1d');
      });
      it('more than 90 days', function () {
        expect(getInterval({period: '90d'}, 'low')).toBe('2d');
      });
    });
  });

  describe('getUsageInterval', function () {
    it('calculates intervals for a period', function () {
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

  describe('lightenHexToRgb', function () {
    it('converts hex to rgb and lightens values', function () {
      expect(lightenHexToRgb(['#2f2936', '#f0f0f0'])).toEqual([
        'rgb(77, 71, 84)',
        'rgb(255, 255, 255)',
      ]);
    });
  });

  describe('processTableResults', function () {
    it('transforms TableDataWithTitle array to chartable data', function () {
      const tableData = [
        {
          data: [
            {
              'geo.country_code': 'PE',
              count: 9215,
            },
            {
              'geo.country_code': 'VI',
              count: 1,
            },
          ],
          meta: {
            'geo.country_code': 'string',
            count: 'integer',
          },
          title: 'Country',
        },
      ];
      const result = {
        title: 'Country',
        data: [
          {
            name: 'PE',
            value: 9215,
          },
          {
            name: 'VI',
            value: 1,
          },
        ],
      };
      expect(processTableResults(tableData)).toEqual(result);
    });
  });
});
