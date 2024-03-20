import ContextSummary from 'sentry/components/events/contextSummary';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import type {Event, Group, Project} from 'sentry/types';

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
