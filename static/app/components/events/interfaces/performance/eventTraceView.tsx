import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {TraceAgentActivityHint} from './agentRun/eventAgentRun';
import type {EventAgentRun} from './agentRun/useEventAgentRun';
import {TracePreview, TracePreviewFullTraceButton} from './tracePreview';
import {eventHasSyntheticTrace} from './utils';

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
  agentRun?: EventAgentRun;
}

export function EventTraceView({
  agentRun,
  group,
  event,
  organization,
}: EventTraceViewProps) {
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
      {agentRun && <TraceAgentActivityHint agentRun={agentRun} event={event} />}
      <TracePreview event={event} organization={organization} source="issues" />
    </FoldSection>
  );
}
