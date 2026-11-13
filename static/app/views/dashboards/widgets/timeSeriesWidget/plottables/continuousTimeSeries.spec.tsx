import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';

import {ContinuousTimeSeries} from './continuousTimeSeries';
import type {Plottable} from './plottable';

describe('ContinuousTimeSeries', () => {
  describe('labelSuffix', () => {
    it.each([
      {alias: undefined, groupBy: undefined, expectedLabel: 'avg(span.duration)'},
      {alias: 'Duration', groupBy: undefined, expectedLabel: 'Duration'},
      {
        alias: undefined,
        groupBy: [{key: 'span.op', value: 'db'}],
        expectedLabel: 'db',
      },
    ])('keeps $expectedLabel separate from transformations', config => {
      const series = TimeSeriesFixture({
        yAxis: 'avg(span.duration)',
        groupBy: config.groupBy,
        requestedTransformations: ['fill(linear)', 'smooth(sma,5)'],
      });
      const plottable = new Dots(series, {alias: config.alias});

      expect(plottable.label).toBe(config.expectedLabel);
      expect(plottable.labelSuffix).toBe('fill(linear) → smooth(sma,5)');
    });
  });

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

  describe('confidence', () => {
    it('is full when no points are sampled', () => {
      expect(new Dots(TimeSeriesFixture()).confidence).toBe('full');

      const unsampled = TimeSeriesFixture({
        values: [
          {timestamp: 1, value: 1, sampleRate: 1, confidence: 'high'},
          {timestamp: 2, value: 2, sampleRate: 1, confidence: 'high'},
        ],
      });
      expect(new Dots(unsampled).confidence).toBe('full');
    });

    it('is high when some points are sampled but none are low confidence', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {timestamp: 1, value: 1, sampleRate: 1, confidence: 'high'},
          {timestamp: 2, value: 2, sampleRate: 0.5, confidence: 'high'},
        ],
      });
      expect(new Dots(timeSeries).confidence).toBe('high');
    });

    it('is mixed when some points are low confidence', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {timestamp: 1, value: 1, sampleRate: 0.5, confidence: 'high'},
          {timestamp: 2, value: 2, sampleRate: 0.01, confidence: 'low'},
        ],
      });
      expect(new Dots(timeSeries).confidence).toBe('mixed');
    });

    it('is low when every point is low confidence', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {timestamp: 1, value: 1, sampleRate: 0.01, confidence: 'low'},
          {timestamp: 2, value: 2, sampleRate: 0.01, confidence: 'low'},
        ],
      });
      expect(new Dots(timeSeries).confidence).toBe('low');
    });

    it('ignores points without a value', () => {
      const timeSeries = TimeSeriesFixture({
        values: [
          {timestamp: 1, value: 1, sampleRate: 0.01, confidence: 'low'},
          {timestamp: 2, value: null, sampleRate: 1, confidence: 'high'},
        ],
      });
      expect(new Dots(timeSeries).confidence).toBe('low');
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
    return [createLineSeries({})];
  }
}
