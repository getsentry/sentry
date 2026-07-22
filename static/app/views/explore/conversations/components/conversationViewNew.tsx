import {useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsStringLiteral, useQueryStates} from 'nuqs';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {ConversationContentLayout} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  CONVERSATION_SPAN_DETAIL_TABS,
  ConversationSpanDetail,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {MessagesPanelNew} from 'sentry/views/explore/conversations/components/messagesPanelNew';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

export type ConversationViewTab = 'transcript' | 'timeline';

export const CONVERSATION_VIEW_TABS: readonly ConversationViewTab[] = [
  'transcript',
  'timeline',
];

interface ConversationViewContentNewProps {
  activeTab: ConversationViewTab;
  conversation: UseConversationsOptions;
  focusedTool?: string | null;
  onDeselectSpan?: () => void;
  onSelectSpan?: (spanId: string) => void;
  onViewTimeline?: () => void;
  selectedSpanId?: string | null;
}

export function ConversationViewContentNew({
  conversation,
  activeTab,
  selectedSpanId,
  onSelectSpan,
  onDeselectSpan,
  onViewTimeline,
  focusedTool,
}: ConversationViewContentNewProps) {
  const isTimeline = activeTab === 'timeline';

  const {nodes, nodeTraceMap, isLoading, error} = useConversation(conversation);

  const [detailState, setDetailState] = useQueryStates(
    {
      detailTab: parseAsStringLiteral(CONVERSATION_SPAN_DETAIL_TABS).withDefault('input'),
    },
    {history: 'replace'}
  );

  const {selectedNode, handleSelectNode} = useConversationSelection({
    nodes,
    selectedSpanId,
    onSelectSpan,
    focusedTool,
    isLoading,
    // The hook never auto-selects a default: `selectedNode` reflects only the
    // sticky selection from the URL (a user click or a deep link), which is why
    // it survives switching tabs. The timeline's default span is layered on
    // below as view-local state so it never leaks back into the transcript.
    autoSelectDefaultNode: false,
  });

  // The timeline opens on its first span by default; the transcript opens on
  // nothing. This default is view-local (never written to the URL) so returning
  // to the transcript only keeps a span open when one was selected manually.
  const defaultTimelineNode = useMemo(() => getDefaultSelectedNode(nodes), [nodes]);
  const [timelineDefaultDismissed, setTimelineDefaultDismissed] = useState(false);

  // Re-show the timeline default each time the user enters the timeline tab.
  useEffect(() => {
    setTimelineDefaultDismissed(false);
  }, [activeTab]);

  const displayedNode = useMemo(() => {
    if (selectedNode) {
      return selectedNode;
    }
    if (isTimeline && !timelineDefaultDismissed) {
      return defaultTimelineNode;
    }
    return;
  }, [selectedNode, isTimeline, timelineDefaultDismissed, defaultTimelineNode]);

  const handleSelectAndOpenDetail = useCallback(
    (node: AITraceSpanNode) => {
      setTimelineDefaultDismissed(false);
      handleSelectNode(node);
    },
    [handleSelectNode]
  );

  const handleCloseDetail = useCallback(() => {
    // Dismiss the timeline default and clear any sticky selection so the pane
    // closes on both tabs and does not spring back to the default.
    setTimelineDefaultDismissed(true);
    setDetailState({detailTab: null});
    onDeselectSpan?.();
  }, [onDeselectSpan, setDetailState]);

  useEffect(() => {
    if (!isLoading && !error && nodes.length === 0) {
      Sentry.captureMessage('User landed on empty conversation detail page', {
        level: 'warning',
      });
    }
  }, [isLoading, error, nodes.length]);

  const isTranscript = !isTimeline;

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (!isLoading && nodes.length === 0) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <ConversationContentLayout
        leftPadding={isTranscript ? '0' : 'md'}
        left={
          isTranscript ? (
            <MessagesPanelNew
              isLoading={isLoading}
              nodes={nodes}
              selectedNodeId={displayedNode?.id ?? null}
              onSelectNode={handleSelectAndOpenDetail}
              onViewTimeline={onViewTimeline}
            />
          ) : (
            <AiSpanTimeline
              isLoading={isLoading}
              nodes={nodes}
              selectedNodeKey={displayedNode?.id ?? ''}
              onSelectNode={handleSelectAndOpenDetail}
              compressGaps
            />
          )
        }
        right={
          // Show the detail pane once a span is resolved: a deep link or manual
          // selection (either tab), or the timeline's default span. While
          // loading, only the deep-linked skeleton is known.
          (isLoading ? Boolean(selectedSpanId) : Boolean(displayedNode)) ? (
            <ConversationSpanDetail
              isLoading={isLoading}
              scrollResetKey={activeTab}
              node={displayedNode ?? undefined}
              traceId={displayedNode ? (nodeTraceMap?.get(displayedNode.id) ?? '') : ''}
              activeTab={detailState.detailTab}
              onTabChange={detailTab => setDetailState({detailTab})}
              onClose={handleCloseDetail}
            />
          ) : null
        }
      />
    </TraceStateProvider>
  );
}
