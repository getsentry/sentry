import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';

import {useMetricDetectorThresholdSeries} from './useMetricDetectorThresholdSeries';

function makeConditions(
  overrides: Array<Partial<Omit<MetricCondition, 'id'>>>
): Array<Omit<MetricCondition, 'id'>> {
  return overrides.map(c => ({
    type: c.type ?? DataConditionType.GREATER,
    comparison: c.comparison ?? 0,
    conditionResult: c.conditionResult ?? DetectorPriorityLevel.HIGH,
  }));
}

describe('useMetricDetectorThresholdSeries', () => {
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

      const {result} = renderHookWithProviders(() =>
        useMetricDetectorThresholdSeries({
          conditions,
          detectionType: 'percent',
          aggregate: 'crash_free_rate(session)',
          comparisonSeries,
        })
      );

      expect(result.current.additionalSeries).toHaveLength(1);
      expect(result.current.additionalSeries[0]?.name).toBe('10% Higher Threshold');
      // 0.95 * (1 + 10/100) = 1.045
      expect(result.current.maxValue).toBeCloseTo(1.045);
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

      const {result} = renderHookWithProviders(() =>
        useMetricDetectorThresholdSeries({
          conditions,
          detectionType: 'percent',
          aggregate: 'crash_free_rate(session)',
          comparisonSeries,
        })
      );

      expect(result.current.additionalSeries).toHaveLength(1);
      expect(result.current.additionalSeries[0]?.name).toBe('40% Lower Threshold');
      // 0.95 * (1 - 40/100) = 0.57
      expect(result.current.maxValue).toBeCloseTo(0.57);
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

      const {result} = renderHookWithProviders(() =>
        useMetricDetectorThresholdSeries({
          conditions,
          detectionType: 'percent',
          aggregate: 'crash_free_rate(session)',
          comparisonSeries,
        })
      );

      // The alert threshold should be 10% (from 110)
      expect(result.current.additionalSeries[0]?.name).toBe('10% Higher Threshold');
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

      const {result} = renderHookWithProviders(() =>
        useMetricDetectorThresholdSeries({
          conditions,
          detectionType: 'percent',
          aggregate: 'count()',
          comparisonSeries,
        })
      );

      expect(result.current.additionalSeries[0]?.name).toBe('10% Higher Threshold');
      // 100 * (1 + 10/100) = 110
      expect(result.current.maxValue).toBeCloseTo(110);
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

      const {result} = renderHookWithProviders(() =>
        useMetricDetectorThresholdSeries({
          conditions,
          detectionType: 'static',
          aggregate: 'crash_free_rate(session)',
        })
      );

      // Static threshold for crash_free_rate(session) 95 should normalize to 0.95
      expect(result.current.maxValue).toBeCloseTo(0.95);
    });
  });

  it('returns empty series when conditions are undefined', () => {
    const {result} = renderHookWithProviders(() =>
      useMetricDetectorThresholdSeries({
        conditions: undefined,
        detectionType: 'static',
        aggregate: 'count()',
      })
    );

    expect(result.current.additionalSeries).toHaveLength(0);
    expect(result.current.maxValue).toBeUndefined();
  });
});
