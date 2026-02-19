import moment from 'moment-timezone';
import {ThemeFixture} from 'sentry-fixture/theme';

import type {XAxisProps} from 'sentry/components/charts/components/xAxis';
import XAxis from 'sentry/components/charts/components/xAxis';
import {shiftTimestampToFakeUtc} from 'sentry/components/charts/timezoneShift';

const theme = ThemeFixture();

jest.mock('moment-timezone', () => {
  const momentActual = jest.requireActual('moment-timezone');
  momentActual.tz.setDefault('America/Los_Angeles');
  return momentActual;
});

describe('Chart XAxis', () => {
  let axisLabelFormatter: (value: string | number, index: number) => string;
  let xAxisObj!: ReturnType<typeof XAxis>;
  const props: XAxisProps = {
    isGroupedByDate: true,
    theme,
  };
  // 2018-07-09T00:00:00Z
  const timestamp = 1531094400000;

  describe('axisLabel', () => {
    describe('With Period > 24h', () => {
      describe('Local timezone (pre-shifted timestamps)', () => {
        // In the new timezone-shifting approach, BaseChart shifts timestamps
        // to "fake UTC" before passing to ECharts. The formatter always
        // parses as UTC. For local-timezone display, we simulate the
        // pre-shifted timestamp that BaseChart would produce.
        const shiftedTimestamp = shiftTimestampToFakeUtc(
          timestamp,
          'America/Los_Angeles'
        );

        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: false,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 0)).toBe('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 1)).toBe('Jul 8 5:00 PM');
        });
      });

      describe('UTC', () => {
        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(timestamp, 1)).toBe('Jul 9 12:00 AM');
        });
      });

      describe('Multiline (pre-shifted timestamps)', () => {
        const shiftedTimestamp = shiftTimestampToFakeUtc(
          timestamp,
          'America/Los_Angeles'
        );

        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            useMultilineDate: true,
            period: '7d',
            utc: false,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 0)).toBe('Jul 8\n5:00 PM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 1)).toBe('Jul 8\n5:00 PM');
        });
      });
    });

    describe('With Period <= 24h', () => {
      describe('Local timezone (pre-shifted timestamps)', () => {
        const shiftedTimestamp = shiftTimestampToFakeUtc(
          timestamp,
          'America/Los_Angeles'
        );

        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: false,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 0)).toBe('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(shiftedTimestamp, 1)).toBe('5:00 PM');
        });
      });

      describe('UTC', () => {
        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(timestamp, 1)).toBe('12:00 AM');
        });
      });

      describe('Multiline', () => {
        beforeEach(() => {
          xAxisObj = XAxis({
            ...props,
            useMultilineDate: true,
            period: '24h',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', () => {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9\n12:00 AM');
        });

        it('formats axis label for second data point', () => {
          expect(axisLabelFormatter(timestamp, 1)).toBe('12:00 AM');
        });
      });
    });
  });

  describe('timezone shifting produces correct display', () => {
    it('shows non-repeating times at nice boundaries when user tz differs from UTC', () => {
      // Simulate timestamps at midnight, 6am, noon, 6pm EST (UTC-5)
      // In real UTC these would be: 05:00, 11:00, 17:00, 23:00
      const midnightEst = moment.utc('2024-01-15T05:00:00').valueOf();
      const sixAmEst = moment.utc('2024-01-15T11:00:00').valueOf();
      const noonEst = moment.utc('2024-01-15T17:00:00').valueOf();

      // After shifting to fake UTC: 00:00, 06:00, 12:00
      const shiftedMidnight = shiftTimestampToFakeUtc(midnightEst, 'America/New_York');
      const shiftedSixAm = shiftTimestampToFakeUtc(sixAmEst, 'America/New_York');
      const shiftedNoon = shiftTimestampToFakeUtc(noonEst, 'America/New_York');

      xAxisObj = XAxis({...props, period: '24h', utc: false});
      // @ts-expect-error formatter type is missing
      axisLabelFormatter = xAxisObj.axisLabel!.formatter;

      // Formatter should show distinct, non-repeating times
      const label1 = axisLabelFormatter(shiftedMidnight, 1);
      const label2 = axisLabelFormatter(shiftedSixAm, 2);
      const label3 = axisLabelFormatter(shiftedNoon, 3);

      expect(label1).toBe('12:00 AM');
      expect(label2).toBe('6:00 AM');
      expect(label3).toBe('12:00 PM');

      // All labels are different — the original bug was that all showed the same time
      expect(new Set([label1, label2, label3]).size).toBe(3);
    });
  });
});
