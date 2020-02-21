import React from 'react';

import {mount} from 'sentry-test/enzyme';
import ChartZoom from 'app/components/charts/chartZoom';

jest.mock('moment', () => {
  const moment = require.requireActual('moment-timezone');
  moment.tz.setDefault('America/Los_Angeles'); // Whatever timezone you want
  return moment;
});

describe('ChartZoom', function() {
  const renderFunc = jest.fn(() => null);
  const routerContext = TestStubs.routerContext();
  let axisLabelFormatter;
  const timestamp = 1531094400000;

  beforeAll(function() {});

  beforeEach(function() {
    renderFunc.mockClear();
  });

  describe('With Period > 24h', function() {
    describe('Local timezone', function() {
      beforeEach(function() {
        mount(
          <ChartZoom period="7d" utc={false}>
            {renderFunc}
          </ChartZoom>,
          routerContext
        );

        axisLabelFormatter = renderFunc.mock.calls[0][0].xAxis.axisLabel.formatter;
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8, 2018 5:00 PM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 8, 2018 5:00 PM');
      });
    });

    describe('UTC', function() {
      beforeEach(function() {
        mount(
          <ChartZoom period="7d" utc>
            {renderFunc}
          </ChartZoom>,
          routerContext
        );

        axisLabelFormatter = renderFunc.mock.calls[0][0].xAxis.axisLabel.formatter;
      });

      it('sets showTimeInTooltip prop for children', function() {
        expect(renderFunc.mock.calls[0][0].showTimeInTooltip).toBe(true);
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9, 2018 12:00 AM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 9, 2018 12:00 AM');
      });
    });
  });

  describe('With Period <= 24h', function() {
    describe('Local timezone', function() {
      beforeEach(function() {
        mount(
          <ChartZoom period="24h" utc={false}>
            {renderFunc}
          </ChartZoom>,
          routerContext
        );

        axisLabelFormatter = renderFunc.mock.calls[0][0].xAxis.axisLabel.formatter;
      });
      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8, 2018 5:00 PM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('5:00 PM');
      });
    });

    describe('UTC', function() {
      beforeEach(function() {
        mount(
          <ChartZoom period="24h" utc>
            {renderFunc}
          </ChartZoom>,
          routerContext
        );

        axisLabelFormatter = renderFunc.mock.calls[0][0].xAxis.axisLabel.formatter;
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9, 2018 12:00 AM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('12:00 AM');
      });
    });
  });
});
