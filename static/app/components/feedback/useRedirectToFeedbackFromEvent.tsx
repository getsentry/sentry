import {useEffect} from 'react';

import type {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export default function useRedirectToFeedbackFromEvent() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {eventId, projectSlug} = useLocationQuery({
    fields: {
      eventId: decodeScalar,
      projectSlug: decodeScalar,
    },
  });

  const {data: event} = useApiQuery<Event>(
    [`/projects/${organization.slug}/${projectSlug}/events/${eventId}/`],
    {
      staleTime: Infinity,
      enabled: Boolean(eventId) && Boolean(projectSlug),
    }
  );

  useEffect(() => {
    if (projectSlug && event?.groupID) {
      navigate(
        `/organizations/${organization.slug}/feedback/?feedbackSlug=${projectSlug}:${event.groupID}`,
        {replace: true}
      );
    }
  }, [navigate, organization.slug, projectSlug, event]);
}
