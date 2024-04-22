import ContextSummary from 'sentry/components/events/contextSummary';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function HighlightsDataSection({event}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  if (!hasNewTagsUI) {
    return null;
  }
  // TODO(Leander): When a design is confirmed, remove this usage of ContextSummary
  return <ContextSummary event={event} />;
}
