import {useCallback, useEffect, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {LazyRender} from 'sentry/components/lazyRender';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {AgentActivityFullTraceButton, EventAgentActivity} from './agentRun/eventAgentRun';
import {useEventAgentRun} from './agentRun/useEventAgentRun';
import {TracePreview, TracePreviewFullTraceButton} from './tracePreview';
import {eventHasSyntheticTrace} from './utils';

type TraceView = 'agent-activity' | 'waterfall';

interface EventTraceViewProps {
  event: Event;
  group: Group;
  organization: Organization;
}

function OnVisible({onVisible}: {onVisible: () => void}) {
  useEffect(onVisible, [onVisible]);
  return null;
}

export function EventTraceView({group, event, organization}: EventTraceViewProps) {
  const traceId = event.contexts.trace?.trace_id;
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  // Performance issues have a Span Evidence section that contains the trace view
  const hasTracePreview =
    !!traceId && !eventHasSyntheticTrace(event) && !issueTypeConfig.spanEvidence.enabled;

  const project = useProjectFromId({project_id: event.projectID});
  const canHaveAgentRun =
    hasTracePreview &&
    organization.features.includes('issue-details-agent-run') &&
    !!project?.hasInsightsAgentMonitoring;
  // Like the waterfall, only look for the agent run once the section is near the viewport.
  const [isInView, setIsInView] = useState(false);
  const markInView = useCallback(() => setIsInView(true), []);
  const agentRun = useEventAgentRun(event, {enabled: canHaveAgentRun && isInView});
  const [selectedView, setSelectedView] = useState<TraceView | null>(null);

  if (!hasTracePreview) {
    return null;
  }

  const insideRun = agentRun.type === 'inside' ? agentRun : null;
  const view: TraceView = insideRun ? (selectedView ?? 'agent-activity') : 'waterfall';

  let content: React.ReactNode;
  if (canHaveAgentRun && !isInView) {
    content = (
      <LazyRender
        observerOptions={ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS}
        containerHeight={200}
      >
        <OnVisible onVisible={markInView} />
      </LazyRender>
    );
  } else if (agentRun.type === 'loading') {
    // Wait for the agent run so the preview does not open on one view and then switch.
    content = <Placeholder height="200px" />;
  } else if (insideRun && view === 'agent-activity') {
    content = (
      <EventAgentActivity
        event={event}
        failingNode={insideRun.failingNode}
        nodes={insideRun.nodes}
      />
    );
  } else {
    content = <TracePreview event={event} organization={organization} source="issues" />;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        <Flex align="center" gap="md">
          {insideRun && view === 'agent-activity' ? (
            <AgentActivityFullTraceButton
              event={event}
              failingNodeId={insideRun.failingNode.id}
            />
          ) : (
            <TracePreviewFullTraceButton
              event={event}
              organization={organization}
              source="issues"
            />
          )}
          {insideRun && (
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
        </Flex>
      }
    >
      {content}
    </FoldSection>
  );
}
