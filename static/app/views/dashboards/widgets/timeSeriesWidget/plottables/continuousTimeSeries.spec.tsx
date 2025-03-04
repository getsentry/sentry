import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import {ContinuousTimeSeries} from './continuousTimeSeries';
import type {Plottable} from './plottable';

describe('ContinuousTimeSeries', () => {
  describe('isEmpty', () => {
    it('plottables as not empty', () => {
      const timeSeries = TimeSeriesFixture();

      const plottable = new Dots(timeSeries);

      expect(plottable.isEmpty).toBeFalsy();
    });

    it('marks empty series as empty', () => {
      const timeSeries = TimeSeriesFixture({
        data: [],
      });

      const plottable = new Dots(timeSeries);

      expect(plottable.isEmpty).toBeTruthy();
    });

    it('marks series of all nulls as empty', () => {
      const timeSeries = TimeSeriesFixture({
        data: [
          {
            value: null,
            timestamp: '2024-10-24T15:00:00-04:00',
          },
          {
            value: null,
            timestamp: '2024-10-24T15:30:00-04:00',
          },
        ],
      });

      const plottable = new Dots(timeSeries);

      expect(plottable.isEmpty).toBeTruthy();
    });
  });

  describe('needsColor', () => {
    it('says that plottables with color config do not need color', () => {
      const timeSeries = TimeSeriesFixture();

      const plottable = new Dots(timeSeries, {color: 'red'});

      expect(plottable.needsColor).toBeFalsy();
    });

    it('says that plottables with no color config need color', () => {
      const timeSeries = TimeSeriesFixture();

      const plottable = new Dots(timeSeries);

      expect(plottable.needsColor).toBeTruthy();
    });
  });
});

class Dots extends ContinuousTimeSeries implements Plottable {
  toSeries(_plottingOptions: any) {
    return [LineSeries({})];
  }
}
