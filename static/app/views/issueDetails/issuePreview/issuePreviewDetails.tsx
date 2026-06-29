import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {EventDetailsContent} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {useGroupEvent} from 'sentry/views/issueDetails/useGroupEvent';

interface IssuePreviewDetailsProps {
  group: Group;
  project: Project;
}

export function IssuePreviewDetails({group, project}: IssuePreviewDetailsProps) {
  const {
    data: event,
    isPending,
    isError,
  } = useGroupEvent({groupId: group.id, eventId: 'recommended'});

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !event) {
    return <LoadingError />;
  }

  return <EventDetailsContent group={group} event={event} project={project} />;
}
