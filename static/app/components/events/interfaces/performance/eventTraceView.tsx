import {useCallback, useEffect, useRef, useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {ISSUE_DETAILS_LAZY_RENDER_OBSERVER_OPTIONS} from 'sentry/components/events/issueDetailsLazyRender';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import {type Event} from 'sentry/types/event';
import {type Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {
  AgentActivityFullTraceButton,
  EventAgentActivity,
  TraceViewActionsSkeleton,
  TraceViewSkeleton,
} from './agentRun/eventAgentRun';
import {useEventAgentRun} from './agentRun/useEventAgentRun';
import {TraceLinkedIssues} from './traceLinkedIssues';
import {TracePreview, TracePreviewFullTraceButton} from './tracePreview';
import {useTraceLinkedIssues} from './useTraceLinkedIssues';
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
  // Both views show the trace's other issues first. Fetch them alongside the agent run
  // so the section can appear once, instead of the issues pushing the view down later.
  const linkedIssues = useTraceLinkedIssues({
    event,
    enabled: canHaveAgentRun && isInView,
  });
  const isLoading = agentRun.type === 'loading' || linkedIssues.isPending;
  const [selectedView, setSelectedView] = useState<TraceView | null>(null);

  const insideRun = agentRun.type === 'inside' ? agentRun : null;
  const view: TraceView = insideRun ? (selectedView ?? 'agent-activity') : 'waterfall';

  // Count each event once, so switching back from the waterfall isn't a second view.
  const isShowingAgentActivity = !isLoading && view === 'agent-activity';
  const trackedEventId = useRef<string | null>(null);
  useEffect(() => {
    if (isShowingAgentActivity && trackedEventId.current !== event.id) {
      trackedEventId.current = event.id;
      trackAnalytics('issue_details.agent_run.viewed', {organization});
    }
  }, [isShowingAgentActivity, event.id, organization]);

  if (!hasTracePreview) {
    return null;
  }

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
  } else if (isLoading) {
    // Wait for both so the preview neither opens on one view and switches, nor grows.
    content = <TraceViewSkeleton />;
  } else if (insideRun && view === 'agent-activity') {
    content = (
      <EventAgentActivity
        event={event}
        failingNode={insideRun.failingNode}
        nodes={insideRun.nodes}
      />
    );
  } else {
    content = (
      <TracePreview
        event={event}
        organization={organization}
        source="issues"
        showLinkedIssues={!canHaveAgentRun}
      />
    );
  }

  // The other issues don't change with the view, so they sit below it, outside the toggle.
  const showLinkedIssuesBelow = canHaveAgentRun && isInView && !isLoading;

  return (
    <FoldSection
      sectionKey={SectionKey.TRACE}
      title={t('Trace Preview')}
      actions={
        isLoading ? (
          <TraceViewActionsSkeleton />
        ) : (
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
        )
      }
    >
      {showLinkedIssuesBelow ? (
        <Stack gap="md">
          {content}
          <TraceLinkedIssues event={event} />
        </Stack>
      ) : (
        content
      )}
    </FoldSection>
  );
}
