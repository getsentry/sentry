import {EventStackTrace} from 'sentry/components/events/eventStackTrace';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {StaticFoldSections} from 'sentry/views/issueDetails/foldSection';

interface IssuePreviewStackTraceProps {
  event: Event;
  group: Group;
  projectSlug: Project['slug'];
}

export function IssuePreviewStackTrace(props: IssuePreviewStackTraceProps) {
  return (
    <StaticFoldSections>
      <EventStackTrace {...props} />
    </StaticFoldSections>
  );
}
