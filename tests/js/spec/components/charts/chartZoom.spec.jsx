import React from 'react';

import {mount} from 'enzyme';
import ChartZoom from 'app/components/charts/chartZoom';
import ConfigStore from 'app/stores/configStore';

describe('ChartZoom', function() {
  const renderFunc = jest.fn(() => null);
  const routerContext = TestStubs.routerContext();
  let axisLabelFormatter;
  let tooltipFormatter;
  const timestamp = 1531094400000;

  beforeAll(function() {
    ConfigStore.loadInitialData({
      user: {options: {timezone: 'America/Los_Angeles'}},
    });
  });

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
        tooltipFormatter = renderFunc.mock.calls[0][0].tooltip.formatAxisLabel;
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8, 2018 5:00 PM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 8, 2018 5:00 PM');
      });

      it('formats tooltip', function() {
        expect(tooltipFormatter(timestamp, true, false)).toEqual('Jul 8, 2018 5:00 PM');
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
        tooltipFormatter = renderFunc.mock.calls[0][0].tooltip.formatAxisLabel;
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9, 2018 12:00 AM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('Jul 9, 2018 12:00 AM');
      });

      it('formats tooltip', function() {
        expect(tooltipFormatter(timestamp, true, true)).toEqual('Jul 9, 2018 12:00 AM');
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
        tooltipFormatter = renderFunc.mock.calls[0][0].tooltip.formatAxisLabel;
      });
      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 8, 2018 5:00 PM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('5:00 PM');
      });

      it('formats tooltip', function() {
        expect(tooltipFormatter(timestamp, true, false)).toEqual('Jul 8, 2018 5:00 PM');
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
        tooltipFormatter = renderFunc.mock.calls[0][0].tooltip.formatAxisLabel;
      });

      it('formats axis label for first data point', function() {
        expect(axisLabelFormatter(timestamp, 0)).toEqual('Jul 9, 2018 12:00 AM');
      });

      it('formats axis label for second data point', function() {
        expect(axisLabelFormatter(timestamp, 1)).toEqual('12:00 AM');
      });

      it('formats tooltip', function() {
        expect(tooltipFormatter(timestamp, true, true)).toEqual('Jul 9, 2018 12:00 AM');
      });
    });
  });
});
