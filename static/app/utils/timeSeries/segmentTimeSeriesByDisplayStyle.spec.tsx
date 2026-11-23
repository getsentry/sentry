import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {markLowConfidence} from './fixtures/markLowConfidence';
import {markDelayedData} from './markDelayedData';
import {segmentTimeSeriesByDisplayStyle} from './segmentTimeSeriesByDisplayStyle';

describe('segmentTimeSeriesByDisplayStyle', () => {
  beforeEach(() => {
    setMockDate(new Date('2024-10-24T15:59:00.000Z')); // Unix: 1729785540000
  });

  afterEach(() => {
    resetMockDate();
  });

  describe('completeness', () => {
    it('Does not split a series with all complete data', () => {
      const serie = markDelayedData(
        {
          yAxis: 'p99(span.duration)',
          values: [
            {
              value: 90,
              timestamp: 1729785240000, // '2024-10-24T15:54:00.000Z'
            },
            {
              value: 100,
              timestamp: 1729785300000, // '2024-10-24T15:55:00.000Z'
            },
            {
              value: 110,
              timestamp: 1729785360000, // '2024-10-24T15:56:00.000Z'
            },
          ],
          meta: {
            valueType: 'duration',
            valueUnit: DurationUnit.MILLISECOND,
            interval: 1 * 1000,
          },
        },
        90
      );

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['completeness'],
      });
      const completeSerie = segments?.[0]?.[0];
      const incompleteSerie = segments?.[1]?.[0];

      expect(completeSerie!.values).toEqual([
        {
          value: 90,
          timestamp: 1729785240000, // '2024-10-24T15:54:00.000Z'
          incomplete: false,
        },
        {
          value: 100,
          timestamp: 1729785300000, // '2024-10-24T15:55:00.000Z'
          incomplete: false,
        },
        {
          value: 110,
          timestamp: 1729785360000, // '2024-10-24T15:56:00.000Z'
          incomplete: false,
        },
      ]);

      expect(incompleteSerie).toBeUndefined();
    });

    it('Does not split a series with all incomplete data', () => {
      const serie = markDelayedData(
        {
          yAxis: 'p99(span.duration)',
          values: [
            {
              value: 90,
              timestamp: 1729785485000, // '2024-10-24T15:58:05.000Z'
            },
            {
              value: 100,
              timestamp: 1729785490000, // '2024-10-24T15:58:10.000Z'
            },
            {
              value: 110,
              timestamp: 1729785495000, // '2024-10-24T15:58:15.000Z'
            },
            {
              value: 120,
              timestamp: 1729785500000, // '2024-10-24T15:58:20.000Z'
            },
          ],
          meta: {
            valueType: 'duration',
            valueUnit: DurationUnit.MILLISECOND,
            interval: 5 * 1000,
          },
        },
        90
      );

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['completeness'],
      });
      const incompleteSerie = segments?.[0]?.[0];
      const completeSerie = segments?.[1]?.[0];

      expect(completeSerie).toBeUndefined();

      expect(incompleteSerie!.values).toEqual([
        {
          value: 90,
          timestamp: 1729785485000, // '2024-10-24T15:58:05.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
        {
          value: 100,
          timestamp: 1729785490000, // '2024-10-24T15:58:10.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
        {
          value: 110,
          timestamp: 1729785495000, // '2024-10-24T15:58:15.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
        {
          value: 120,
          timestamp: 1729785500000, // '2024-10-24T15:58:20.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
      ]);
    });

    it('Splits a series with partial incomplete data', () => {
      const serie = markDelayedData(
        {
          yAxis: 'p99(span.duration)',
          values: [
            {
              value: 100,
              timestamp: 1729785300000, // '2024-10-24T15:55:00.000Z'
            },
            {
              value: 110,
              timestamp: 1729785360000, // '2024-10-24T15:56:00.000Z'
            },
            {
              value: 120,
              timestamp: 1729785420000, // '2024-10-24T15:57:00.000Z'
            },
            {
              value: 130,
              timestamp: 1729785480000, // '2024-10-24T15:58:00.000Z'
            },
            {
              value: 140,
              timestamp: 1729785540000, // '2024-10-24T15:59:00.000Z'
            },
          ],
          meta: {
            valueType: 'duration',
            valueUnit: DurationUnit.MILLISECOND,
            interval: 1 * 60 * 1000,
          },
        },
        90
      );

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['completeness'],
      });
      const completeSerie = segments?.[0]?.[0];
      const incompleteSerie = segments?.[1]?.[0];

      expect(completeSerie!.values).toEqual([
        {
          value: 100,
          timestamp: 1729785300000, // '2024-10-24T15:55:00.000Z'
          incomplete: false,
        },
        {
          value: 110,
          timestamp: 1729785360000, // '2024-10-24T15:56:00.000Z'
          incomplete: false,
        },
      ]);

      expect(incompleteSerie!.values).toEqual([
        {
          value: 110,
          timestamp: 1729785360000, // '2024-10-24T15:56:00.000Z'
          incomplete: false,
        },
        {
          value: 120,
          timestamp: 1729785420000, // '2024-10-24T15:57:00.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
        {
          value: 130,
          timestamp: 1729785480000, // '2024-10-24T15:58:00.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
        {
          value: 140,
          timestamp: 1729785540000, // '2024-10-24T15:59:00.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
      ]);
    });

    it('Splits a series with long buckets', () => {
      // The time buckets are an hour long. The ingestion delay is 90s. The last buckets should be marked incomplete.

      const serie = markDelayedData(
        {
          yAxis: 'p99(span.duration)',
          values: [
            {
              value: 110,
              timestamp: 1729771200000, // '2024-10-24T12:00:00.000Z'
            },
            {
              value: 120,
              timestamp: 1729774800000, // '2024-10-24T13:00:00.000Z'
            },
            {
              value: 130,
              timestamp: 1729778400000, // '2024-10-24T14:00:00.000Z'
            },
            {
              value: 140,
              timestamp: 1729782000000, // '2024-10-24T15:00:00.000Z'
            },
          ],
          meta: {
            valueType: 'duration',
            valueUnit: DurationUnit.MILLISECOND,
            interval: 1 * 60 * 60 * 1000,
          },
        },
        90
      );

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['completeness'],
      });
      const completeSerie = segments?.[0]?.[0];
      const incompleteSerie = segments?.[1]?.[0];

      expect(completeSerie!.values).toEqual([
        {
          value: 110,
          timestamp: 1729771200000, // '2024-10-24T12:00:00.000Z'
          incomplete: false,
        },
        {
          value: 120,
          timestamp: 1729774800000, // '2024-10-24T13:00:00.000Z'
          incomplete: false,
        },
        {
          value: 130,
          timestamp: 1729778400000, // '2024-10-24T14:00:00.000Z'
          incomplete: false,
        },
      ]);

      expect(incompleteSerie!.values).toEqual([
        {
          value: 130,
          timestamp: 1729778400000, // '2024-10-24T14:00:00.000Z'
          incomplete: false,
        },
        {
          value: 140,
          timestamp: 1729782000000, // '2024-10-24T15:00:00.000Z'
          incomplete: true,
          incompleteReason: 'INGESTION_PENDING',
        },
      ]);
    });

    it('Ignores incomplete data unless enabled', () => {
      const serie = markDelayedData(makeSerie([100, 110, 120, 130, 140]), 90);

      const segments = segmentTimeSeriesByDisplayStyle(serie, {segmentBy: []});

      expect(summarize(segments)).toEqual([['normal', [100, 110, 120, 130, 140]]]);
    });
  });

  describe('confidence', () => {
    it('Ignores low confidence data unless enabled', () => {
      const serie = markLowConfidence(makeSerie([100, 110, 120, 130, 140]), [110, 120]);

      const segments = segmentTimeSeriesByDisplayStyle(serie, {segmentBy: []});

      expect(summarize(segments)).toEqual([['normal', [100, 110, 120, 130, 140]]]);
    });

    it('Does not split a series with all low confidence data', () => {
      const serie = markLowConfidence(makeSerie([100, 110, 120]), [100, 110, 120]);

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['confidence'],
      });

      expect(summarize(segments)).toEqual([['lowConfidence', [100, 110, 120]]]);
    });

    it('Splits a series with partial low confidence data', () => {
      const serie = markLowConfidence(makeSerie([100, 110, 120, 130, 140]), [110, 120]);

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['confidence'],
      });

      expect(summarize(segments)).toEqual([
        ['normal', [100]],
        ['lowConfidence', [100, 110, 120, 130]],
        ['normal', [130, 140]],
      ]);
    });
  });

  describe('completeness and confidence', () => {
    it('Gives incomplete data precedence over low confidence data', () => {
      // The last three buckets are incomplete
      const serie = markLowConfidence(
        markDelayedData(makeSerie([100, 110, 120, 130, 140]), 90),
        [110, 120]
      );

      const segments = segmentTimeSeriesByDisplayStyle(serie, {
        segmentBy: ['completeness', 'confidence'],
      });

      expect(summarize(segments)).toEqual([
        ['normal', [100]],
        ['lowConfidence', [100, 110]],
        ['incomplete', [110, 120, 130, 140]],
      ]);
    });
  });
});

/**
 * One-minute buckets ending at the mocked "now", 2024-10-24T15:59:00.000Z
 */
function makeSerie(values: number[]): TimeSeries {
  return {
    yAxis: 'p99(span.duration)',
    values: values.map((value, index) => ({
      value,
      timestamp: 1729785540000 - (values.length - 1 - index) * 60 * 1000,
    })),
    meta: {
      valueType: 'duration',
      valueUnit: DurationUnit.MILLISECOND,
      interval: 60 * 1000,
    },
  };
}

function summarize(segments: ReturnType<typeof segmentTimeSeriesByDisplayStyle>) {
  return segments.map(([serie, style]) => [style, serie.values.map(item => item.value)]);
}
