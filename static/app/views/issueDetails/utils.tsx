import {useMemo} from 'react';
import isEmpty from 'lodash/isEmpty';
import orderBy from 'lodash/orderBy';

import {bulkUpdate, useFetchIssueTags} from 'sentry/actionCreators/group';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Group, GroupActivity} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {useLocation} from 'sentry/utils/useLocation';

export function markEventSeen(
  api: Client,
  orgId: string,
  projectId: string,
  groupId: string
) {
  bulkUpdate(
    api,
    {
      orgId,
      projectId,
      itemIds: [groupId],
      failSilently: true,
      data: {hasSeen: true},
    },
    {}
  );
}

export function fetchGroupUserReports(
  orgSlug: string,
  groupId: string,
  query: Record<string, string>
) {
  const api = new Client();

  return api.requestPromise(`/organizations/${orgSlug}/issues/${groupId}/user-reports/`, {
    includeAllArgs: true,
    query,
  });
}

export function useDefaultIssueEvent() {
  const user = useLegacyStore(ConfigStore).user;
  const options = user ? user.options : null;
  return options?.defaultIssueEvent ?? 'recommended';
}

/**
 * Returns the environment name for an event or null
 *
 * @param event
 */
export function getEventEnvironment(event: Event) {
  const tag = event.tags.find(({key}) => key === 'environment');

  return tag ? tag.value : null;
}

const SUBSCRIPTION_REASONS = {
  commented: t(
    "You're receiving workflow notifications because you have commented on this issue."
  ),
  assigned: t(
    "You're receiving workflow notifications because you were assigned to this issue."
  ),
  bookmarked: t(
    "You're receiving workflow notifications because you have bookmarked this issue."
  ),
  changed_status: t(
    "You're receiving workflow notifications because you have changed the status of this issue."
  ),
  mentioned: t(
    "You're receiving workflow notifications because you have been mentioned in this issue."
  ),
};

/**
 * @param group
 * @param removeLinks add/remove links to subscription reasons text (default: false)
 * @returns Reason for subscription
 */
export function getSubscriptionReason(group: Group) {
  if (group.subscriptionDetails && group.subscriptionDetails.disabled) {
    return t('You have disabled workflow notifications for this project.');
  }

  if (!group.isSubscribed) {
    return t('Subscribe to workflow notifications for this issue');
  }

  if (group.subscriptionDetails) {
    const {reason} = group.subscriptionDetails;
    if (reason === 'unknown') {
      return t(
        "You're receiving workflow notifications because you are subscribed to this issue."
      );
    }

    if (reason && SUBSCRIPTION_REASONS.hasOwnProperty(reason)) {
      return SUBSCRIPTION_REASONS[reason];
    }
  }

  return t(
    "You're receiving updates because you are subscribed to workflow notifications for this project."
  );
}

export function getGroupMostRecentActivity(activities: GroupActivity[]) {
  // Most recent activity
  return orderBy([...activities], ({dateCreated}) => new Date(dateCreated), ['desc'])[0];
}

export enum ReprocessingStatus {
  REPROCESSED_AND_HASNT_EVENT = 'reprocessed_and_hasnt_event',
  REPROCESSED_AND_HAS_EVENT = 'reprocessed_and_has_event',
  REPROCESSING = 'reprocessing',
  NO_STATUS = 'no_status',
}

// Reprocessing Checks
export function getGroupReprocessingStatus(
  group: Group,
  mostRecentActivity?: GroupActivity
) {
  const {status, count, activity: activities} = group;
  const groupCount = Number(count);

  switch (status) {
    case 'reprocessing':
      return ReprocessingStatus.REPROCESSING;
    case 'unresolved': {
      const groupMostRecentActivity =
        mostRecentActivity ?? getGroupMostRecentActivity(activities);
      if (groupMostRecentActivity?.type === 'reprocess') {
        if (groupCount === 0) {
          return ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT;
        }
        return ReprocessingStatus.REPROCESSED_AND_HAS_EVENT;
      }
      return ReprocessingStatus.NO_STATUS;
    }
    default:
      return ReprocessingStatus.NO_STATUS;
  }
}

export const useFetchIssueTagsForDetailsPage = (
  {
    groupId,
    orgSlug,
    environment = [],
    isStatisticalDetector = false,
    statisticalDetectorParameters,
  }: {
    environment: string[];
    orgSlug: string;
    groupId?: string;
    isStatisticalDetector?: boolean;
    statisticalDetectorParameters?: {
      durationBaseline: number;
      end: string;
      start: string;
      transaction: string;
    };
  },
  {enabled = true}: {enabled?: boolean} = {}
) => {
  return useFetchIssueTags(
    {
      groupId,
      orgSlug,
      environment,
      readable: true,
      limit: 4,
      isStatisticalDetector,
      statisticalDetectorParameters,
    },
    {enabled}
  );
};

export function useEnvironmentsFromUrl(): string[] {
  const location = useLocation();
  const envs = location.query.environment;

  const envsArray = useMemo(() => {
    return typeof envs === 'string' ? [envs] : envs ?? [];
  }, [envs]);

  return envsArray;
}

export function getGroupDetailsQueryData({
  environments,
}: {
  environments?: string[];
} = {}): Record<string, string | string[]> {
  // Note, we do not want to include the environment key at all if there are no environments
  const query: Record<string, string | string[]> = {
    ...(!isEmpty(environments) ? {environment: environments} : {}),
    expand: ['inbox', 'owners'],
    collapse: ['release', 'tags'],
  };

  return query;
}

export function getGroupEventDetailsQueryData({
  environments,
  query,
  stacktraceOnly,
}: {
  environments?: string[];
  query?: string;
  stacktraceOnly?: boolean;
} = {}): Record<string, string | string[]> {
  const defaultParams = {
    collapse: stacktraceOnly ? ['stacktraceOnly'] : ['fullRelease'],
    ...(query ? {query} : {}),
  };

  if (!environments || isEmpty(environments)) {
    return defaultParams;
  }

  return {...defaultParams, environment: environments};
}
