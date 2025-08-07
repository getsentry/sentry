import type {GroupTag} from 'sentry/views/issueDetails/groupTags/useGroupTags';

export interface FlagDrawerItem extends GroupTag {
  distribution: {
    baseline: Record<string, number>;
    outliers: Record<string, number>;
  };
  suspect: {
    baselinePercent: undefined | number;
    score: undefined | number;
  };
  changes?: unknown[];
}
