import {setMockDate} from 'sentry-test/utils';

import {getUtcDateString} from 'sentry/utils/dates';

import {buildDetectorZoomQuery, computeZoomRangeMs} from './buildDetectorZoomQuery';

describe('buildDetectorZoomQuery', () => {
  it('uses absolute start/end for historical ranges', () => {
    setMockDate(Date.parse('2026-02-01T00:00:00Z'));
    const zoomRange = computeZoomRangeMs({
      startMs: Date.parse('2025-01-01T00:00:00Z'),
      endMs: Date.parse('2025-01-01T01:00:00Z'),
      intervalSeconds: 60,
    });

    expect('statsPeriod' in zoomRange).toBe(false);

    const query = buildDetectorZoomQuery({project: '1', statsPeriod: '14d'}, zoomRange);

    expect(query).toEqual({
      project: '1',
      start: getUtcDateString(Date.parse('2024-12-31T23:50:00Z')), // start -10 * 60 seconds
      end: getUtcDateString(Date.parse('2025-01-01T01:10:00Z')), // end + 10 * 60 seconds
      statsPeriod: undefined,
    });
  });

  it('uses statsPeriod for ongoing ranges close to now', () => {
    setMockDate(Date.parse('2026-02-01T12:00:00Z'));
    const zoomRange = computeZoomRangeMs({
      startMs: Date.parse('2026-02-01T10:00:00Z'),
      endMs: Date.parse('2026-02-01T12:05:00Z'),
      intervalSeconds: 60,
    });

    expect(zoomRange).toEqual({statsPeriod: '4h'});

    const query = buildDetectorZoomQuery(
      {project: '1', start: 'old-start', end: 'old-end'},
      zoomRange
    );

    expect(query).toEqual({
      project: '1',
      start: undefined,
      end: undefined,
      statsPeriod: '4h',
    });
  });

  it('uses day units when the duration resolves to whole days', () => {
    setMockDate(Date.parse('2026-02-05T00:00:00Z'));
    const zoomRange = computeZoomRangeMs({
      startMs: Date.parse('2026-02-02T00:10:00Z'),
      endMs: Date.parse('2026-02-04T23:55:00Z'),
      intervalSeconds: 60,
    });

    expect(zoomRange).toEqual({statsPeriod: '3d'});

    const query = buildDetectorZoomQuery({project: '1'}, zoomRange);

    expect(query).toEqual({
      project: '1',
      start: undefined,
      end: undefined,
      statsPeriod: '3d',
    });
  });
});
