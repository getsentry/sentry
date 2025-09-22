import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import LineSeries from 'sentry/components/charts/series/lineSeries';

import {ContinuousTimeSeries} from './continuousTimeSeries';
import type {Plottable} from './plottable';

describe('ContinuousTimeSeries', () => {
  describe('isEmpty', () => {
    it('marks normal plottables as not empty', () => {
      const timeSeries = TimeSeriesFixture();

      const plottable = new Dots(timeSeries);

      expect(plottable.isEmpty).toBeFalsy();
    });

    it('marks empty series as empty', () => {
      const timeSeries = TimeSeriesFixture({
        values: [],
      });

      const plottable = new Dots(timeSeries);

      expect(plottable.isEmpty).toBeTruthy();
    });

    it('marks series of all nulls as empty', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {
            value: null,
            timestamp: 1729796400000, // '2024-10-24T15:00:00-04:00'
          },
          {
            value: null,
            timestamp: 1729798200000, // '2024-10-24T15:30:00-04:00'
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

  describe('start/end', () => {
    it('sets start and end to null if there is not data', () => {
      const timeSeries = TimeSeriesFixture({
        values: [],
      });

      const plottable = new Dots(timeSeries);

      expect(plottable.start).toBeNull();
      expect(plottable.end).toBeNull();
    });

    it('sets start and end to the same date if only one data point exists', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {
            value: 10,
            timestamp: 1729796400000, // '2024-10-24T15:00:00-04:00'
          },
        ],
      });

      const plottable = new Dots(timeSeries);

      expect(plottable.start).toBe(1729796400000);
      expect(plottable.end).toBe(1729796400000);
    });

    it('returns the start and end if available', () => {
      const timeSeries = TimeSeriesFixture();

      const plottable = new Dots(timeSeries);

      expect(plottable.start).toBe(1729796400000);
      expect(plottable.end).toBe(1729798200000);
    });
  });

  describe('name', () => {
    it('name is properly formatted', () => {
      const timeSeries = TimeSeriesFixture({
        groupBy: [{key: 'release', value: 'v0.0.2'}],
      });

      const plottable = new Dots(timeSeries);
      expect(plottable.name).toBe('eps() : release : v0.0.2');
    });
  });
});

class Dots extends ContinuousTimeSeries implements Plottable {
  toSeries(_plottingOptions: any) {
    return [LineSeries({})];
  }
}
