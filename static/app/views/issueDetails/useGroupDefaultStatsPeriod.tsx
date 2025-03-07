import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import HookStore from 'sentry/stores/hookStore';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {getPeriod} from 'sentry/utils/duration/getPeriod';
import getDaysSinceDate, {getDaysSinceDatePrecise} from 'sentry/utils/getDaysSinceDate';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

/**
 * Get the default stats period for a group.
 * Defaults to the life of the group if no stats period is set.
 */
export function useGroupDefaultStatsPeriod(
  group: Group | undefined | null,
  project: Project
): ReturnType<typeof getPeriod> | undefined {
  const useGetMaxRetentionDays =
    HookStore.get('react-hook:use-get-max-retention-days')[0] ??
    (() => MAX_PICKABLE_DAYS);
  const maxRetentionDays = useGetMaxRetentionDays();

  if (!group) {
    return undefined;
  }

  const issueTypeConfig = getConfigForIssueType(group, project);
  if (!issueTypeConfig.defaultTimePeriod.sinceFirstSeen) {
    return undefined;
  }

  const daysSinceFirstSeen = getDaysSinceDate(group.firstSeen);

  if (daysSinceFirstSeen === 0) {
    const precise = Math.ceil(getDaysSinceDatePrecise(group.firstSeen) * 24);
    return {statsPeriod: `${precise}h`};
  }

  if (!maxRetentionDays) {
    return {statsPeriod: `30d`};
  }

  return {statsPeriod: `${Math.min(maxRetentionDays, daysSinceFirstSeen)}d`};
}
