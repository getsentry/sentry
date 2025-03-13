import moment from 'moment-timezone';

import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import HookStore from 'sentry/stores/hookStore';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';

function getDaysSinceDateRoundedUp(date: string): number {
  const dateWithTime = moment(new Date(date)).startOf('day');
  const currentDay = moment().startOf('day');
  const daysDiff = currentDay.diff(dateWithTime, 'days');

  // Trigger fallback to hours
  if (daysDiff === 0) {
    return 0;
  }

  return daysDiff + 1;
}

const DEFAULT_STATS_PERIOD = '14d';

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
    return {statsPeriod: DEFAULT_STATS_PERIOD};
  }

  const issueTypeConfig = getConfigForIssueType(group, project);
  if (!issueTypeConfig.defaultTimePeriod.sinceFirstSeen) {
    return {statsPeriod: DEFAULT_STATS_PERIOD};
  }

  const daysSinceFirstSeen = getDaysSinceDateRoundedUp(group.firstSeen);

  if (daysSinceFirstSeen === 0) {
    const minutesDiff = moment().diff(moment(new Date(group.firstSeen)), 'minutes');
    // Minimum of 2 hours, add 1 hour to any time window
    const hoursDiff = Math.max(1, Math.ceil(minutesDiff / 60)) + 1;
    return {statsPeriod: `${hoursDiff}h`};
  }

  if (!maxRetentionDays) {
    return {statsPeriod: `30d`};
  }

  return {statsPeriod: `${Math.min(maxRetentionDays, daysSinceFirstSeen)}d`};
}
