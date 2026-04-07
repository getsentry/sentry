import {useEffect} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import type {Event} from 'sentry/types/event';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';

export function useRedirectToFeedbackFromEvent() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const [eventId] = useQueryState('eventId', parseAsString);
  const [projectSlug] = useQueryState('projectSlug', parseAsString);

  const {data: event} = useApiQuery<Event>(
    [
      getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/', {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug ?? '',
          eventId: eventId ?? '',
        },
      }),
    ],
    {
      staleTime: Infinity,
      enabled: Boolean(eventId) && Boolean(projectSlug),
    }
  );

  useEffect(() => {
    if (projectSlug && event?.groupID) {
      navigate(
        {
          pathname: makeFeedbackPathname({
            path: '/',
            organization,
          }),
          query: {
            feedbackSlug: `${projectSlug}:${event.groupID}`,
          },
        },
        {replace: true}
      );
    }
  }, [navigate, projectSlug, event, organization]);
}
