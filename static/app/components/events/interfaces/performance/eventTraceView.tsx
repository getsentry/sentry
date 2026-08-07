import {eventHasSyntheticTrace} from 'sentry/components/events/interfaces/performance/utils';
import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {TracePreview, TracePreviewFullTraceButton} from './tracePreview';

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  // Performance issues have a Span Evidence section that contains the trace view
  if (!traceId || eventHasSyntheticTrace(event) || issueTypeConfig.spanEvidence.enabled) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        <TracePreviewFullTraceButton
          event={event}
          organization={organization}
          source="issues"
        />
      }
    >
      <TracePreview event={event} organization={organization} source="issues" />
    </FoldSection>
  );
}
