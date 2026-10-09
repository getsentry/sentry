import {Fragment, useCallback, useEffect, useMemo, useState, type UIEvent} from 'react';
import * as Sentry from '@sentry/react';
import {parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {t} from 'sentry/locale';
import {ConversationContentLayout} from 'sentry/views/explore/conversations/components/conversationLayout';
import {
  CONVERSATION_SPAN_DETAIL_TABS,
  ConversationSpanDetail,
} from 'sentry/views/explore/conversations/components/conversationSpanDetail';
import {MessagesPanel} from 'sentry/views/explore/conversations/components/messagesPanel';
import {
  useConversation,
  type UseConversationsOptions,
} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useConversationScrollRestoration} from 'sentry/views/explore/conversations/hooks/useConversationScrollRestoration';
import {useConversationSelection} from 'sentry/views/explore/conversations/hooks/useConversationSelection';
import {AiSpanTimeline} from 'sentry/views/insights/pages/agents/components/aiSpanTimeline';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

export type ConversationViewTab = 'transcript' | 'timeline';

export const CONVERSATION_VIEW_TABS: readonly ConversationViewTab[] = [
  'transcript',
  'timeline',
];

interface ConversationViewContentProps {
  activeTab: ConversationViewTab;
  conversation: UseConversationsOptions;
  focusedTool?: string | null;
  onDeselectSpan?: () => void;
  onSelectSpan?: (spanId: string) => void;
  onViewTimeline?: () => void;
  selectedSpanId?: string | null;
}

export function ConversationViewContent({
  conversation,
  activeTab,
  selectedSpanId,
  onSelectSpan,
  onDeselectSpan,
  onViewTimeline,
  focusedTool,
}: ConversationViewContentProps) {
  const isTimeline = activeTab === 'timeline';

  const {
    nodes,
    nodeTraceMap,
    canAutoFetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    loadNextPage,
  } = useConversation({...conversation, autoFetchAll: false});

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
  });

  // The timeline opens on its first span by default; the transcript opens on
  // nothing. This default is view-local (never written to the URL) so returning
  // to the transcript only keeps a span open when one was selected manually.
  const defaultTimelineNode = useMemo(() => getDefaultSelectedNode(nodes), [nodes]);
  const [timelineDefaultDismissed, setTimelineDefaultDismissed] = useState(false);

  // Re-show the timeline default each time the user enters the timeline tab.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setTimelineDefaultDismissed(false);
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
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

  // Each tab keeps its own scroll position in the shared content container; a
  // selected span is scrolled into view instead when switching tabs. This keys
  // off the sticky (URL) selection, not `displayedNode`: the timeline's
  // view-local default span is not a real selection, so entering the timeline
  // restores its saved offset rather than snapping to that default.
  const contentRef = useConversationScrollRestoration({
    activeTab,
    selectedNodeId: selectedNode?.id ?? null,
  });

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const container = event.currentTarget;
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      container.scrollHeight - container.scrollTop - container.clientHeight < 200
    ) {
      loadNextPage();
    }
  }

  const needsMoreSelectionData = Boolean(
    (selectedSpanId && !selectedNode) || focusedTool
  );

  useEffect(() => {
    if (!isLoading && canAutoFetchNextPage && needsMoreSelectionData) {
      loadNextPage();
    }
  }, [canAutoFetchNextPage, isLoading, loadNextPage, needsMoreSelectionData]);

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

  const isEmptyConversation = !isLoading && !hasNextPage && nodes.length === 0;

  useEffect(() => {
    if (!error && isEmptyConversation) {
      Sentry.captureMessage('User landed on empty conversation detail page', {
        level: 'warning',
      });
    }
  }, [error, isEmptyConversation]);

  const isTranscript = !isTimeline;
  const isDetailLoading = Boolean(
    selectedSpanId &&
    !displayedNode &&
    (isLoading || canAutoFetchNextPage || isFetchingNextPage)
  );

  if (error) {
    return <EmptyMessage>{t('Failed to load conversation')}</EmptyMessage>;
  }

  if (isEmptyConversation) {
    return <EmptyMessage>{t('No AI spans found in this conversation')}</EmptyMessage>;
  }

  return (
    <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
      <ConversationContentLayout
        contentRef={contentRef}
        leftPadding={isTranscript ? '0' : 'md'}
        onScroll={handleScroll}
        left={
          <Fragment>
            {isTranscript ? (
              <MessagesPanel
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
            )}
            {(hasNextPage || isFetchingNextPage) && (
              <Flex align="center" justify="center" padding="md">
                <Button size="xs" busy={isFetchingNextPage} onClick={loadNextPage}>
                  {t('Load more')}
                </Button>
              </Flex>
            )}
          </Fragment>
        }
        right={
          // Show the detail pane once a span is resolved: a deep link or manual
          // selection (either tab), or the timeline's default span. While
          // loading, only the deep-linked skeleton is known.
          isDetailLoading || displayedNode ? (
            <ConversationSpanDetail
              isLoading={isDetailLoading}
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
