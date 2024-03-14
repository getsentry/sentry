import {useEffect} from 'react';

import decodeFeedbackSlug from 'sentry/components/feedback/decodeFeedbackSlug';
import type {Event} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

export default function useCurrentFeedbackId() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {eventId, feedbackSlug, projectSlug} = useLocationQuery({
    fields: {
      eventId: decodeScalar,
      feedbackSlug: val => decodeFeedbackSlug(val).feedbackId ?? '',
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

  return feedbackSlug;
}
