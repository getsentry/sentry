import {useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsBoolean, parseAsStringLiteral, useQueryStates} from 'nuqs';

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
      detailOpen: parseAsBoolean.withDefault(true),
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
    // Neither view auto-selects a span on load. The span detail only opens on
    // user action or when a span is deep-linked in the URL.
    autoSelectDefaultNode: false,
  });
  const handleSelectAndOpenDetail = useCallback(
    (node: AITraceSpanNode) => {
      setDetailState({detailOpen: true});
      handleSelectNode(node);
    },
    [handleSelectNode, setDetailState]
  );

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
              selectedNodeId={selectedNode?.id ?? null}
              onSelectNode={handleSelectAndOpenDetail}
              onViewTimeline={onViewTimeline}
            />
          ) : (
            <AiSpanTimeline
              isLoading={isLoading}
              nodes={nodes}
              selectedNodeKey={selectedNode?.id ?? ''}
              onSelectNode={handleSelectAndOpenDetail}
              compressGaps
            />
          )
        }
        right={
          // Only show the detail pane (and its loading skeleton) when a span is
          // deep-linked in the URL, or once the user has selected one.
          detailState.detailOpen &&
          (isLoading ? Boolean(selectedSpanId) : Boolean(selectedNode)) ? (
            <ConversationSpanDetail
              isLoading={isLoading}
              scrollResetKey={activeTab}
              node={selectedNode ?? undefined}
              traceId={selectedNode ? (nodeTraceMap?.get(selectedNode.id) ?? '') : ''}
              activeTab={detailState.detailTab}
              onTabChange={detailTab => setDetailState({detailTab})}
              onClose={() => {
                setDetailState({detailOpen: false, detailTab: null});
                onDeselectSpan?.();
              }}
            />
          ) : null
        }
      />
    </TraceStateProvider>
  );
}
