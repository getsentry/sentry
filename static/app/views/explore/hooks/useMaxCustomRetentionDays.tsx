import HookStore from 'sentry/stores/hookStore';
import type {DataCategory} from 'sentry/types/core';

export default function useMaxCustomRetentionDays(
  dataCategory: DataCategory,
  defaultMaxPickableDays: number
): number {
  const usePlanRetention =
    HookStore.get('react-hook:use-plan-retention')[0] ?? (() => undefined);
  const planRetention = usePlanRetention();
  const downsampledRetention = planRetention?.[dataCategory]?.downsampled;
  const standardRetention = planRetention?.[dataCategory]?.standard;

  if (downsampledRetention && downsampledRetention > 0) {
    return downsampledRetention;
  }

  if (standardRetention && standardRetention > 0) {
    return standardRetention;
  }

  return defaultMaxPickableDays;
}
