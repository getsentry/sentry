import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/eventDetails';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import TraceTimeLineOrRelatedIssue from 'sentry/views/issueDetails/traceTimelineOrRelatedIssue';

interface TraceDataSectionProps {
  event: Event;
}

export function TraceDataSection({event}: TraceDataSectionProps) {
  return (
    <InterimSection title={t('Trace Connections')} type={SectionKey.TRACE}>
      <TraceTimeLineOrRelatedIssue event={event} />
    </InterimSection>
  );
}
