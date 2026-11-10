import type {LineSeriesOption} from 'echarts';
import {ThemeFixture} from 'sentry-fixture/theme';

import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';

import {getMetricDetectorThresholdSeries} from './metricDetectorThresholdSeries';

const theme = ThemeFixture();

function makeConditions(
  overrides: Array<Partial<Omit<MetricCondition, 'id'>>>
): Array<Omit<MetricCondition, 'id'>> {
  return overrides.map(c => ({
    type: c.type ?? DataConditionType.GREATER,
    comparison: c.comparison ?? 0,
    conditionResult: c.conditionResult ?? DetectorPriorityLevel.HIGH,
  }));
}

function getThresholdLineNames(additionalSeries: LineSeriesOption[]) {
  return additionalSeries.filter(series => series.name).map(series => series.name);
}

type MarkAreaRange = [{yAxis: number}, {yAxis: number}];

function getStaticBandRanges(additionalSeries: LineSeriesOption[]) {
  return additionalSeries
    .flatMap(series => (series.markArea?.data ?? []) as MarkAreaRange[])
    .map(([lower, upper]) => [lower.yAxis, upper.yAxis]);
}

describe('getMetricDetectorThresholdSeries', () => {
  describe('percent detection with session percentage aggregates', () => {
    it('computes correct delta for crash_free_rate (comparison=110 → 10% higher)', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous crash_free_rate(session)',
          data: [{name: 1609459200000, value: 0.95}],
        },
      ];

      const conditions = makeConditions([
        {
          type: DataConditionType.GREATER,
          comparison: 110,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'crash_free_rate(session)',
        comparisonSeries,
        theme,
      });

      expect(getThresholdLineNames(thresholdSeries.additionalSeries)).toEqual([
        '10% Higher Threshold',
      ]);
      // 0.95 * (1 + 10/100) = 1.045
      expect(thresholdSeries.maxValue).toBeCloseTo(1.045);
    });

    it('computes correct delta for crash_free_rate (comparison=60 → 40% lower)', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous crash_free_rate(session)',
          data: [{name: 1609459200000, value: 0.95}],
        },
      ];

      const conditions = makeConditions([
        {
          type: DataConditionType.LESS,
          comparison: 60,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'crash_free_rate(session)',
        comparisonSeries,
        theme,
      });

      expect(getThresholdLineNames(thresholdSeries.additionalSeries)).toEqual([
        '40% Lower Threshold',
      ]);
      // 0.95 * (1 - 40/100) = 0.57
      expect(thresholdSeries.maxValue).toBeCloseTo(0.57);
    });

    it('computes correct resolution delta for crash_free_rate', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous crash_free_rate(session)',
          data: [{name: 1609459200000, value: 0.95}],
        },
      ];

      const conditions = makeConditions([
        {
          type: DataConditionType.GREATER,
          comparison: 110,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
        {
          type: DataConditionType.LESS_OR_EQUAL,
          comparison: 105,
          conditionResult: DetectorPriorityLevel.OK,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'crash_free_rate(session)',
        comparisonSeries,
        theme,
      });

      // The alert threshold should be 10% (from 110)
      expect(thresholdSeries.additionalSeries[0]?.name).toBe('10% Higher Threshold');
    });
  });

  describe('percent detection with non-session aggregates', () => {
    it('computes correct delta for count() (comparison=110 → 10% higher)', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous count()',
          data: [{name: 1609459200000, value: 100}],
        },
      ];

      const conditions = makeConditions([
        {
          type: DataConditionType.GREATER,
          comparison: 110,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'count()',
        comparisonSeries,
        theme,
      });

      expect(thresholdSeries.additionalSeries[0]?.name).toBe('10% Higher Threshold');
      // 100 * (1 + 10/100) = 110
      expect(thresholdSeries.maxValue).toBeCloseTo(110);
    });
  });

  describe('static detection with session percentage aggregates', () => {
    it('normalizes crash_free_rate threshold to 0-1 scale', () => {
      const conditions = makeConditions([
        {
          type: DataConditionType.GREATER,
          comparison: 95,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'static',
        aggregate: 'crash_free_rate(session)',
        theme,
      });

      // Static threshold for crash_free_rate(session) 95 should normalize to 0.95
      expect(thresholdSeries.maxValue).toBeCloseTo(0.95);
    });
  });

  describe('threshold bands', () => {
    it('splits static thresholds into adjacent ok, warning, and critical bands', () => {
      const conditions = makeConditions([
        {comparison: 10000, conditionResult: DetectorPriorityLevel.HIGH},
        {comparison: 5000, conditionResult: DetectorPriorityLevel.MEDIUM},
        {
          type: DataConditionType.LESS_OR_EQUAL,
          comparison: 5000,
          conditionResult: DetectorPriorityLevel.OK,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'static',
        aggregate: 'count()',
        theme,
      });

      expect(getStaticBandRanges(thresholdSeries.additionalSeries)).toEqual([
        [-Infinity, 5000],
        [5000, 10000],
        [10000, Infinity],
      ]);
    });

    it('goes straight from ok to critical without a warning threshold', () => {
      const conditions = makeConditions([
        {comparison: 10000, conditionResult: DetectorPriorityLevel.HIGH},
        {
          type: DataConditionType.LESS_OR_EQUAL,
          comparison: 10000,
          conditionResult: DetectorPriorityLevel.OK,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'static',
        aggregate: 'count()',
        theme,
      });

      expect(getStaticBandRanges(thresholdSeries.additionalSeries)).toEqual([
        [-Infinity, 10000],
        [10000, Infinity],
      ]);
    });

    it('ends the ok band at a manual resolution for below thresholds', () => {
      const conditions = makeConditions([
        {
          type: DataConditionType.LESS,
          comparison: 50,
          conditionResult: DetectorPriorityLevel.HIGH,
        },
        {
          type: DataConditionType.LESS,
          comparison: 100,
          conditionResult: DetectorPriorityLevel.MEDIUM,
        },
        {
          type: DataConditionType.GREATER_OR_EQUAL,
          comparison: 150,
          conditionResult: DetectorPriorityLevel.OK,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'static',
        aggregate: 'count()',
        theme,
      });

      expect(getStaticBandRanges(thresholdSeries.additionalSeries)).toEqual([
        [150, Infinity],
        [50, 100],
        [-Infinity, 50],
      ]);
    });

    it('stacks the warning band between the percent threshold lines', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous count()',
          data: [{name: 1609459200000, value: 100}],
        },
      ];

      const conditions = makeConditions([
        {comparison: 200, conditionResult: DetectorPriorityLevel.HIGH},
        {comparison: 150, conditionResult: DetectorPriorityLevel.MEDIUM},
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'count()',
        comparisonSeries,
        theme,
      });

      const bandSeries = thresholdSeries.additionalSeries.filter(series => !series.name);

      expect(
        bandSeries.map(series => ({
          data: series.data,
          origin: series.areaStyle?.origin,
          stack: series.stack,
        }))
      ).toEqual([
        {data: [[1609459200000, 150]], origin: 'start', stack: undefined},
        {
          data: [[1609459200000, 150]],
          origin: undefined,
          stack: 'percent-threshold-band-1',
        },
        {
          data: [[1609459200000, 50]],
          origin: undefined,
          stack: 'percent-threshold-band-1',
        },
        {data: [[1609459200000, 200]], origin: 'end', stack: undefined},
      ]);
    });

    it('lists lines from most severe to a manual percent resolution and ends the ok band there', () => {
      const comparisonSeries = [
        {
          seriesName: 'Previous count()',
          data: [{name: 1609459200000, value: 100}],
        },
      ];

      const conditions = makeConditions([
        {comparison: 200, conditionResult: DetectorPriorityLevel.HIGH},
        {comparison: 150, conditionResult: DetectorPriorityLevel.MEDIUM},
        {
          type: DataConditionType.LESS_OR_EQUAL,
          comparison: 125,
          conditionResult: DetectorPriorityLevel.OK,
        },
      ]);

      const thresholdSeries = getMetricDetectorThresholdSeries({
        conditions,
        detectionType: 'percent',
        aggregate: 'count()',
        comparisonSeries,
        theme,
      });

      expect(getThresholdLineNames(thresholdSeries.additionalSeries)).toEqual([
        '100% Higher Threshold',
        '50% Higher Threshold',
        '25% Higher Resolution Threshold',
      ]);

      const okBand = thresholdSeries.additionalSeries.find(
        series => series.areaStyle?.origin === 'start'
      );

      expect(okBand?.data).toEqual([[1609459200000, 125]]);
    });
  });

  it('returns empty series when conditions are undefined', () => {
    const thresholdSeries = getMetricDetectorThresholdSeries({
      conditions: undefined,
      detectionType: 'static',
      aggregate: 'count()',
      theme,
    });

    expect(thresholdSeries.additionalSeries).toHaveLength(0);
    expect(thresholdSeries.maxValue).toBeUndefined();
  });
});
