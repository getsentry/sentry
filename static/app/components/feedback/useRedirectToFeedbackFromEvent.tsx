import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import type {Event} from 'sentry/types/event';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';

export function useRedirectToFeedbackFromEvent() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const [eventId] = useQueryState('eventId', parseAsString);
  const [projectSlug] = useQueryState('projectSlug', parseAsString);

  const {data: event} = useQuery({
    ...apiOptions.as<Event>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: projectSlug ?? '',
          eventId: eventId ?? '',
        },
        staleTime: Infinity,
      }
    ),
    enabled: Boolean(eventId) && Boolean(projectSlug),
  });

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
