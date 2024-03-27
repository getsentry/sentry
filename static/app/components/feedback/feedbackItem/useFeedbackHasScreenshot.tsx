import {useMemo} from 'react';

import {useFetchEventAttachments} from 'sentry/actionCreators/events';
import type {Event} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  event: Event;
  projectSlug: string;
}

export default function useFeedbackScreenshot({projectSlug, event}: Props) {
  const organization = useOrganization();
  const {data: attachments} = useFetchEventAttachments({
    orgSlug: organization.slug,
    projectSlug,
    eventId: event.id,
  });

  const screenshots = useMemo(() => {
    return attachments ?? [];
  }, [attachments]);

  return {
    screenshots,
  };
}
