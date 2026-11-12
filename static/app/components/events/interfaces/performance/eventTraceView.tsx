import {useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {EventAgentActivity, OpenAgentActivityButton} from './agentRun/eventAgentRun';
import {useEventAgentRun} from './agentRun/useEventAgentRun';
import {TracePreview, TracePreviewFullTraceButton} from './tracePreview';
import {eventHasSyntheticTrace} from './utils';

type TraceView = 'agent-activity' | 'waterfall';

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  // Performance issues have a Span Evidence section that contains the trace view
  const hasTracePreview =
    !!traceId && !eventHasSyntheticTrace(event) && !issueTypeConfig.spanEvidence.enabled;

  const agentRun = useEventAgentRun(event, {
    enabled: hasTracePreview && organization.features.includes('issue-details-agent-run'),
  });
  const [selectedView, setSelectedView] = useState<TraceView | null>(null);

  if (!hasTracePreview) {
    return null;
  }

  const hasAgentActivity = agentRun.type !== 'none';
  const view: TraceView = hasAgentActivity
    ? (selectedView ?? (agentRun.type === 'inside' ? 'agent-activity' : 'waterfall'))
    : 'waterfall';

  return (
    <FoldSection
      sectionKey={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        <Flex align="center" gap="md">
          {hasAgentActivity && (
            <SegmentedControl<TraceView>
              aria-label={t('Trace view')}
              size="xs"
              value={view}
              onChange={setSelectedView}
            >
              <SegmentedControl.Item key="agent-activity">
                {t('Agent Activity')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="waterfall">
                {t('Waterfall')}
              </SegmentedControl.Item>
            </SegmentedControl>
          )}
          {view === 'agent-activity' ? (
            <OpenAgentActivityButton agentRun={agentRun} event={event} />
          ) : (
            <TracePreviewFullTraceButton
              event={event}
              organization={organization}
              source="issues"
            />
          )}
        </Flex>
      }
    >
      {view === 'agent-activity' ? (
        <EventAgentActivity agentRun={agentRun} event={event} />
      ) : (
        <TracePreview event={event} organization={organization} source="issues" />
      )}
    </FoldSection>
  );
}
