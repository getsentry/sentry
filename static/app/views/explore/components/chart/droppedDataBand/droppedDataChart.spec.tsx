import {AnnotationFixture} from 'sentry-fixture/annotation';

import {annotationsToSeries} from './droppedDataChart';

describe('annotationsToSeries', () => {
  it('returns an empty object for no annotations', () => {
    expect(annotationsToSeries([])).toEqual({});
  });

  it('groups annotations by outcome, formatting the label', () => {
    const series = annotationsToSeries([
      AnnotationFixture({outcome: 'rate_limited', start: 0, end: 1, eventCount: 5}),
    ]);

    expect(Object.keys(series)).toEqual(['Rate limited']);
  });

  it('zerofills every outcome onto the shared, sorted time axis', () => {
    // client_discard has data at t=0 and t=2, rate_limited only at t=1.
    const series = annotationsToSeries([
      AnnotationFixture({outcome: 'client_discard', start: 2, end: 3, eventCount: 3}),
      AnnotationFixture({outcome: 'client_discard', start: 0, end: 1, eventCount: 1}),
      AnnotationFixture({outcome: 'rate_limited', start: 1, end: 2, eventCount: 7}),
    ]);

    // Both series cover all three sorted timestamps, zerofilled where missing.
    expect(series['Client discard']!.values).toEqual([
      {timestamp: 0, value: 1},
      {timestamp: 1, value: 0},
      {timestamp: 2, value: 3},
    ]);
    expect(series['Rate limited']!.values).toEqual([
      {timestamp: 0, value: 0},
      {timestamp: 1, value: 7},
      {timestamp: 2, value: 0},
    ]);
  });

  it('sums eventCount for annotations sharing an outcome and timestamp', () => {
    const series = annotationsToSeries([
      AnnotationFixture({outcome: 'invalid', start: 0, end: 1, eventCount: 4}),
      AnnotationFixture({outcome: 'invalid', start: 0, end: 1, eventCount: 6}),
    ]);

    expect(series.Invalid!.values).toEqual([{timestamp: 0, value: 10}]);
  });

  it('derives the interval from the first gap between buckets', () => {
    const series = annotationsToSeries([
      AnnotationFixture({outcome: 'filtered', start: 0, end: 1, eventCount: 1}),
      AnnotationFixture({outcome: 'filtered', start: 60_000, end: 60_001, eventCount: 1}),
    ]);

    expect(series.Filtered!.meta.interval).toBe(60_000);
  });
});
