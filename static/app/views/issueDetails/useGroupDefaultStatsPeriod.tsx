import moment from 'moment-timezone';

import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {getOverride} from 'sentry/overrideRegistry';
import {IssueCategory, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {getPeriod} from 'sentry/utils/duration/getPeriod';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';

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
  isSinceRegressed: boolean;
  sinceDate: string | undefined;
};

/**
 * Get the default stats period for a group.
 * Defaults to the life of the group, or its latest regression when enabled.
 */
export function useGroupDefaultStatsPeriod(
  group: Group | undefined | null,
  project: Project
): UseGroupDefaultStatsPeriodResult {
  const useGetMaxRetentionDays =
    getOverride('react-hook:use-get-max-retention-days') ?? (() => MAX_PICKABLE_DAYS);
  const maxRetentionDays = useGetMaxRetentionDays(); // oxlint-disable-line react/hooks -- Hook comes from the override registry, which is populated before React renders.
  const organization = useOrganization();
  const sinceDate =
    organization.features.includes('issue-details-since-regressed') &&
    group?.issueCategory === IssueCategory.ERROR &&
    group.activeAt &&
    moment(group.activeAt).isAfter(group.firstSeen)
      ? group.activeAt
      : group?.firstSeen;
  const defaultPeriod = {
    isMaxRetention: false,
    isSinceRegressed: sinceDate !== group?.firstSeen,
    sinceDate,
  };

  if (!group || !sinceDate) {
    return {...defaultPeriod, statsPeriod: DEFAULT_STATS_PERIOD};
  }

  const issueTypeConfig = getConfigForIssueType(group, project);
  if (!issueTypeConfig.defaultTimePeriod.sinceFirstSeen) {
    return {...defaultPeriod, statsPeriod: DEFAULT_STATS_PERIOD};
  }

  const daysSinceDate = getDaysSinceDateRoundedUp(sinceDate);

  if (daysSinceDate === 0) {
    const minutesDiff = moment().diff(moment(new Date(sinceDate)), 'minutes');
    // Minimum of 2 hours, add 1 hour to any time window
    const hoursDiff = Math.max(1, Math.ceil(minutesDiff / 60)) + 1;
    return {...defaultPeriod, statsPeriod: `${hoursDiff}h`};
  }

  if (!maxRetentionDays) {
    return {...defaultPeriod, statsPeriod: '30d', isMaxRetention: true};
  }

  const clampedRetentionDays = Math.min(maxRetentionDays, daysSinceDate);

  return {
    ...defaultPeriod,
    statsPeriod: `${clampedRetentionDays}d`,
    isMaxRetention: clampedRetentionDays === maxRetentionDays,
  };
}
