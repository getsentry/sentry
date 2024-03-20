import ContextSummary from 'sentry/components/events/contextSummary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import {t} from 'sentry/locale';
import type {Event, Group, Project} from 'sentry/types';
import {objectIsEmpty} from 'sentry/utils';

interface HighlightsSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function HighlightsDataSection({event}: HighlightsSectionProps) {
  const hasNewTagsUI = useHasNewTagsUI();
  if (!hasNewTagsUI || objectIsEmpty(event.contexts)) {
    return null;
  }

  return (
    <EventDataSection
      title={t('Highlighted Event Data')}
      data-test-id="highlighted-event-data"
      type="highlighted-event-data"
    >
      <ContextSummary event={event} />
    </EventDataSection>
  );
}
