import moment from 'moment-timezone';

import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {HookStore} from 'sentry/stores/hookStore';
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

type UseGroupDefaultStatsPeriodResult = ReturnType<typeof getPeriod> & {
  /**
   * Whether the default stats period is the max retention days.
   */
  isMaxRetention: boolean;
};

/**
 * Get the default stats period for a group.
 * Defaults to the life of the group if no stats period is set.
 */
export function useGroupDefaultStatsPeriod(
  group: Group | undefined | null,
  project: Project
): UseGroupDefaultStatsPeriodResult {
  const useGetMaxRetentionDays =
    HookStore.get('react-hook:use-get-max-retention-days')[0] ??
    (() => MAX_PICKABLE_DAYS);
  const maxRetentionDays = useGetMaxRetentionDays();
  let isMaxRetention = false;

  if (!group) {
    return {statsPeriod: DEFAULT_STATS_PERIOD, isMaxRetention};
  }

  const issueTypeConfig = getConfigForIssueType(group, project);
  if (!issueTypeConfig.defaultTimePeriod.sinceFirstSeen) {
    return {statsPeriod: DEFAULT_STATS_PERIOD, isMaxRetention};
  }

  const daysSinceFirstSeen = getDaysSinceDateRoundedUp(group.firstSeen);

  if (daysSinceFirstSeen === 0) {
    const minutesDiff = moment().diff(moment(new Date(group.firstSeen)), 'minutes');
    // Minimum of 2 hours, add 1 hour to any time window
    const hoursDiff = Math.max(1, Math.ceil(minutesDiff / 60)) + 1;
    return {statsPeriod: `${hoursDiff}h`, isMaxRetention};
  }

  if (!maxRetentionDays) {
    isMaxRetention = true;
    return {statsPeriod: '30d', isMaxRetention};
  }

  const clampedRetentionDays = Math.min(maxRetentionDays, daysSinceFirstSeen);
  isMaxRetention = clampedRetentionDays === maxRetentionDays;

  return {statsPeriod: `${clampedRetentionDays}d`, isMaxRetention};
}

/**
 * Returns a short-form duration string (e.g. "2mo", "19d", "3h") without converting to larger units like weeks, matching the sidebar's TimeSince display.
 */
export function getFirstSeenDuration(firstSeen: string): string {
  const duration = moment.duration(moment().diff(firstSeen));

  const months = duration.asMonths();

  if (months >= 1) {
    return `${Math.round(months)}mo`;
  }

  const days = duration.asDays();

  if (days >= 1) {
    return `${Math.round(days)}d`;
  }

  return `${Math.max(1, Math.round(duration.asHours()))}h`;
}
