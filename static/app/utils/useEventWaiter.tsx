import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

const DEFAULT_POLL_INTERVAL = 5000;

/**
 * When no event has been received this will be set to null or false.
 * Otherwise it will be the Group of the issue that was received.
 * Or in the case of transactions & replay the value will be set to true.
 * The `group.id` value is used to generate links directly into the event.
 */
type FirstEvent = null | boolean | Group;

type EventType = 'error' | 'transaction' | 'replay' | 'profile' | 'log';

interface UseEventWaiterOptions {
  eventType: EventType;
  organization: Organization;
  project: Project;
  disabled?: boolean;
  pollInterval?: number;
}

function getFirstEvent(eventType: EventType, resp: Project) {
  switch (eventType) {
    case 'error':
      return resp.firstEvent;
    case 'transaction':
      return resp.firstTransactionEvent;
    case 'replay':
      return resp.hasReplays;
    case 'profile':
      return resp.hasProfiles;
    case 'log':
      return resp.hasLogs;
    default:
      return null;
  }
}

/**
 * Hook that polls for the first event of a project.
 * Returns null until the first event is detected, then returns the
 * resolved FirstEvent (a Group for errors, or true for other event types).
 * Once resolved, polling stops automatically.
 */
export function useEventWaiter({
  eventType,
  organization,
  project,
  disabled,
  pollInterval = DEFAULT_POLL_INTERVAL,
}: UseEventWaiterOptions): FirstEvent {
  const shouldPoll = !disabled && !!organization && !!project;

  const projectUrl = getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/', {
    path: {
      organizationIdOrSlug: organization.slug,
      projectIdOrSlug: project.slug,
    },
  });

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
  const projectQuery = useApiQuery<Project>([projectUrl], {
    refetchInterval: query => {
      if (!shouldPoll) {
        return false;
      }
      // Stop polling once the first event has been detected
      if (query.state.data) {
        const [projectData] = query.state.data;
        if (getFirstEvent(eventType, projectData)) {
          return false;
        }
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

  const firstEvent = projectQuery.data
    ? getFirstEvent(eventType, projectQuery.data)
    : null;

  // For errors, fetch the first issue group once we know the firstEvent exists
  const issuesQuery = useApiQuery<Group[]>([issuesUrl], {
    enabled: eventType === 'error' && !!firstEvent,
    staleTime: 0,
  });

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

  if (firstEvent === null || firstEvent === false) {
    return null;
  }

  if (eventType === 'error') {
    if (!issuesQuery.data) {
      return null;
    }
    // The event may have expired, default to true
    return (
      issuesQuery.data.find((issue: Group) => issue.firstSeen === firstEvent) || true
    );
  }

  // transaction, replay, profile, log
  return Boolean(firstEvent);
}
