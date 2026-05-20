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
 * Converts a getRelativeDate/moment.fromNow(true) string into short form.
 * e.g. "19 days" → "19d", "a month" → "1mo", "3 hours" → "3h"
 */
export function shortenRelativeDate(relativeDate: string): string {
  const match = relativeDate.match(/^(\d+|an?)\s+(\w+)$/);
  if (!match) {
    return '1m';
  }
  const num = match[1] === 'a' || match[1] === 'an' ? '1' : match[1];
  const unit = match[2];

  if (!unit) {
    return '1m';
  }

  if (unit.startsWith('month')) {
    return `${num}mo`;
  }
  if (unit.startsWith('year')) {
    return `${num}yr`;
  }
  if (unit.startsWith('day')) {
    return `${num}d`;
  }
  if (unit.startsWith('hour')) {
    return `${num}h`;
  }
  if (unit.startsWith('minute')) {
    return `${num}m`;
  }
  if (unit.startsWith('second')) {
    return `${num}s`;
  }
  return '1m';
}
