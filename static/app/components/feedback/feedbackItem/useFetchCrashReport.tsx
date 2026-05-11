import {skipToken, useQuery} from '@tanstack/react-query';

import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface Props {
  crashReportId: string;
  organization: Organization;
  projectSlug: string;
}

export function useFetchCrashReport({crashReportId, organization, projectSlug}: Props) {
  const {data: eventData, isFetching: isEventFetching} = useQuery({
    ...apiOptions.as<Event>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug,
          eventId: crashReportId,
        },
        staleTime: 0,
      }
    ),
    // The default delay starts at 1000ms and doubles with each try. That's too slow, we'll just show the error quickly instead.
    retryDelay: 250,
  });

  const {data: groupData, isFetching: isGroupFetching} = useQuery(
    apiOptions.as<Group>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
      path: eventData?.groupID
        ? {organizationIdOrSlug: organization.slug, issueId: eventData.groupID}
        : skipToken,
      staleTime: 0,
    })
  );

  return {
    eventData,
    groupData,
    isFetching: isEventFetching || isGroupFetching,
  };
}
