import XAxis from 'app/components/charts/components/xAxis';

jest.mock('moment', () => {
  const moment = jest.requireActual('moment-timezone');
  moment.tz.setDefault('America/Los_Angeles'); // Whatever timezone you want
  return moment;
});

describe('Chart XAxis', function() {
  let axisLabelFormatter;
  let xAxisObj;
  const props = {
    isGroupedByDate: true,
  };
  const timestamp = 1531094400000;

  describe('axisLabel', function() {
    describe('With Period > 24h', function() {
      describe('Local timezone', function() {
        beforeEach(function() {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: false,
          });

          axisLabelFormatter = xAxisObj.axisLabel.formatter;
        });

        it('formats axis label for first data point', function() {
          expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', function() {
          expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 8 5:00 PM');
        });
      });

      describe('UTC', function() {
        beforeEach(function() {
          xAxisObj = XAxis({
            ...props,
            period: '7d',
            utc: true,
          });

          axisLabelFormatter = xAxisObj.axisLabel.formatter;
        });

        it('formats axis label for first data point', function() {
          expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', function() {
          expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 9 12:00 AM');
        });
      });
    });

    describe('With Period <= 24h', function() {
      describe('Local timezone', function() {
        beforeEach(function() {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: false,
          });

          axisLabelFormatter = xAxisObj.axisLabel.formatter;
        });

        it('formats axis label for first data point', function() {
          expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8 5:00 PM');
        });

        it('formats axis label for second data point', function() {
          expect(axisLabelFormatter(timestamp, 1)).toEqual('5:00 PM');
        });
      });

      describe('UTC', function() {
        beforeEach(function() {
          xAxisObj = XAxis({
            ...props,
            period: '24h',
            utc: true,
          });

          axisLabelFormatter = xAxisObj.axisLabel.formatter;
        });

        it('formats axis label for first data point', function() {
          expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9 12:00 AM');
        });

        it('formats axis label for second data point', function() {
          expect(axisLabelFormatter(timestamp, 1)).toEqual('12:00 AM');
        });
      });
    });
  });
});
