import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';

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
  const [firstIssue, setFirstEvent] = useState<FirstEvent>(null);

  const shouldPoll = !disabled && !firstIssue && !!organization && !!project;

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
    refetchInterval: shouldPoll ? pollInterval : false,
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
    enabled: eventType === 'error' && !!firstEvent && !firstIssue,
    staleTime: 0,
  });

  // Resolve firstIssue from query data
  useEffect(() => {
    if (firstIssue) {
      return;
    }

    if (firstEvent === null || firstEvent === false) {
      return;
    }

    if (eventType === 'error') {
      if (!issuesQuery.data) {
        return;
      }
      // The event may have expired, default to true
      const resolved =
        issuesQuery.data.find((issue: Group) => issue.firstSeen === firstEvent) || true;
      setFirstEvent(resolved);
    } else {
      // transaction, replay, profile, log
      setFirstEvent(Boolean(firstEvent));
    }
  }, [firstEvent, eventType, issuesQuery.data, firstIssue]);

  // Report errors to Sentry (matching original behavior)
  useEffect(() => {
    if (!projectQuery.error) {
      return;
    }

    const err = projectQuery.error;
    if (err instanceof RequestError) {
      if (err.status && [401, 403, 404, 0].includes(err.status)) {
        return;
      }

      Sentry.setExtras({
        status: err.status,
        detail: err.responseJSON?.detail,
      });
    }

    const captureError = new Error(`Error polling for first ${eventType} event`);
    try {
      captureError.cause = err;
    } catch {
      // some browsers don't let you set a `cause`
    }
    Sentry.captureException(captureError);
  }, [projectQuery.error, eventType]);

  return firstIssue;
}
