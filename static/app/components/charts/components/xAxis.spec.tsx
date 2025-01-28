import type {XAxisProps} from 'sentry/components/charts/components/xAxis';
import XAxis from 'sentry/components/charts/components/xAxis';
import {lightTheme} from 'sentry/utils/theme';

jest.mock('moment-timezone', () => {
  const moment = jest.requireActual('moment-timezone');
  moment.tz.setDefault('America/Los_Angeles'); // Whatever timezone you want
  return moment;
});

describe('Chart XAxis', function () {
  let axisLabelFormatter: (value: string | number, index: number) => string;
  let xAxisObj!: ReturnType<typeof XAxis>;
  const props: XAxisProps = {
    isGroupedByDate: true,
    theme: lightTheme,
  };
  const timestamp = 1531094400000;

  describe('axisLabel', function () {
    describe('With Period > 24h', function () {
      describe('Local timezone', function () {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: false,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('Jul 8 5:00 PM');
        });
      });

      describe('UTC', function () {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('Jul 9 12:00 AM');
        });
      });

      describe('Multiline', () => {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            useMultilineDate: true,
            period: '7d',
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 8\n5:00 PM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('Jul 8\n5:00 PM');
        });
      });
    });

    describe('With Period <= 24h', function () {
      describe('Local timezone', function () {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: false,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('5:00 PM');
        });
      });

      describe('UTC', function () {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('12:00 AM');
        });
      });

      describe('Multiline', () => {
        beforeEach(function () {
          xAxisObj = XAxis({
            ...props,
            useMultilineDate: true,
            period: '24h',
            utc: true,
          });

          // @ts-expect-error formatter type is missing
          axisLabelFormatter = xAxisObj.axisLabel!.formatter;
        });

        it('formats axis label for first data point', function () {
          expect(axisLabelFormatter(timestamp, 0)).toBe('Jul 9\n12:00 AM');
        });

        it('formats axis label for second data point', function () {
          expect(axisLabelFormatter(timestamp, 1)).toBe('12:00 AM');
        });
      });
    });
  });
});
