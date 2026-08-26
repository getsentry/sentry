import {useEffect} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {makeDetailedProjectApiOptions} from 'sentry/utils/project/useDetailedProject';
import {useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const DEFAULT_POLL_INTERVAL = 5000;

/**
 * When no event has been received this will be set to null or false.
 * Otherwise it will be the Group of the issue that was received.
 * Or in the case of transactions & replay the value will be set to true.
 * The `group.id` value is used to generate links directly into the event.
 */
type EventWaiterResult = null | boolean | Group;

type ProjectEventValue = string | boolean | null;

type EventType = 'error' | 'transaction' | 'replay' | 'profile' | 'log';

const EVENT_FIELDS = {
  error: 'firstEvent',
  transaction: 'firstTransactionEvent',
  replay: 'hasReplays',
  profile: 'hasProfiles',
  log: 'hasLogs',
} as const satisfies Record<EventType, keyof Project>;

interface UseEventWaiterOptions {
  eventType: EventType;
  organization: Organization;
  project: Project;
  disabled?: boolean;
  pollInterval?: number;
}

function getProjectEventValue(eventType: EventType, project: Project): ProjectEventValue {
  return project[EVENT_FIELDS[eventType]];
}

/**
 * If we observed an update, write it to ProjectsStore to notify downstream
 * listeners.
 */
function maybeUpdateProjectsStore(eventType: EventType, projectData: Project): void {
  const storedProject = ProjectsStore.getById(projectData.id);
  const field = EVENT_FIELDS[eventType];
  const value = projectData[field];

  if (!storedProject || storedProject[field] || !value) {
    return;
  }

  ProjectsStore.onUpdateSuccess({id: projectData.id, [field]: value});
}

/**
 * Hook that polls for the first event of a project.
 * Returns null until the first event is detected, then returns the
 * resolved event (a Group for errors, or true for other event types).
 * Once resolved, polling stops automatically.
 */
export function useEventWaiter({
  eventType,
  organization,
  project,
  disabled,
  pollInterval = DEFAULT_POLL_INTERVAL,
}: UseEventWaiterOptions): EventWaiterResult {
  const shouldPoll = !disabled && !!organization && !!project;

  const issuesUrl = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
      },
    }
  );

  // Poll the project endpoint to detect when the first event arrives
  const projectQuery = useQuery({
    ...makeDetailedProjectApiOptions({
      orgSlug: organization.slug,
      projectSlug: project.slug,
    }),
    refetchInterval: query => {
      if (!shouldPoll) {
        return false;
      }
      // Stop polling once the first event has been detected
      const projectData = query.state.data?.json;
      if (projectData && getProjectEventValue(eventType, projectData)) {
        return false;
      }
      return pollInterval;
    },
    enabled: shouldPoll,
    staleTime: 0,
    retry: (_, error) => {
      if (error instanceof RequestError) {
        // Stop retrying for auth/not-found errors
        if (error.status && [401, 403, 404, 0].includes(error.status)) {
          return false;
        }
      }
      return true;
    },
  });

  const projectData = projectQuery.data;
  const projectEventValue = projectData
    ? getProjectEventValue(eventType, projectData)
    : null;

  // For errors, fetch the first issue group once we know the first event exists
  const issuesQuery = useApiQuery<Group[]>([issuesUrl], {
    enabled: eventType === 'error' && !!projectEventValue,
    staleTime: 0,
  });

  useEffect(() => {
    if (!projectData) {
      return;
    }

    maybeUpdateProjectsStore(eventType, projectData);
  }, [eventType, projectData]);

  // Report errors to Sentry (matching original behavior)
  useEffect(() => {
    if (!projectQuery.error) {
      return;
    }

    const err = projectQuery.error;
    if (err instanceof RequestError) {
      if (err.status !== undefined && [401, 403, 404, 0].includes(err.status)) {
        return;
      }

      Sentry.setExtras({
        status: err.status,
        detail: err.responseJSON?.detail,
      });
    }

    Sentry.captureException(
      new Error(`Error polling for first ${eventType} event`, {cause: err})
    );
  }, [projectQuery.error, eventType]);

  if (projectEventValue === null || projectEventValue === false) {
    return null;
  }

  if (eventType === 'error') {
    if (!issuesQuery.data) {
      return null;
    }
    // The event may have expired, default to true
    const group =
      typeof projectEventValue === 'string'
        ? issuesQuery.data.find((issue: Group) => issue.firstSeen === projectEventValue)
        : undefined;
    return group || true;
  }

  // transaction, replay, profile, log
  return Boolean(projectEventValue);
}
