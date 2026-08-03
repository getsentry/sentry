import {useCallback, useMemo, useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useFocusedToolSpan} from 'sentry/views/explore/conversations/hooks/useFocusedToolSpan';
import {extractMessagesFromNodes} from 'sentry/views/explore/conversations/utils/conversationMessages';
import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface UseConversationSelectionOptions {
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  /**
   * Auto-select the first assistant span (and any deep-linked span) on load.
   * Disabled by the redesign, where the span detail only opens on user action.
   */
  autoSelectDefaultNode?: boolean;
  focusedTool?: string | null;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

/**
 * Manages node selection state for conversation views.
 * Handles default selection, focused tool auto-selection,
 * and keeping selection in sync when nodes change.
 */
export function useConversationSelection({
  nodes,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
  isLoading,
  autoSelectDefaultNode = true,
}: UseConversationSelectionOptions) {
  const organization = useOrganization();

  const handleSpanFound = useCallback(
    (spanId: string) => {
      onSelectSpan?.(spanId);
    },
    [onSelectSpan]
  );

  useFocusedToolSpan({
    nodes,
    focusedTool: focusedTool ?? null,
    isLoading,
    onSpanFound: handleSpanFound,
  });

  // Fired here (the user-click funnel for both the transcript and timeline tabs)
  // rather than in onSelectSpan, which is also invoked by programmatic selection.
  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      trackAnalytics('conversations.detail.select-span', {organization});
      onSelectSpan?.(node.id);
    },
    [onSelectSpan, organization]
  );

  const defaultNodeId = useMemo(() => {
    const messages = extractMessagesFromNodes(nodes);
    const firstAssistant = messages.find(m => m.role === 'assistant');
    return firstAssistant?.nodeId ?? getDefaultSelectedNode(nodes)?.id;
  }, [nodes]);

  const selectedNode = useMemo(() => {
    const explicitNode = nodes.find(node => node.id === selectedSpanId);
    if (explicitNode || !autoSelectDefaultNode) {
      return explicitNode;
    }
    return nodes.find(node => node.id === defaultNodeId);
  }, [nodes, selectedSpanId, defaultNodeId, autoSelectDefaultNode]);

  useEffect(() => {
    if (isLoading || !defaultNodeId || focusedTool || !autoSelectDefaultNode) {
      return;
    }

    const isCurrentSpanValid =
      selectedSpanId && nodes.some(node => node.id === selectedSpanId);

    if (!isCurrentSpanValid) {
      onSelectSpan?.(defaultNodeId);
    }
  }, [
    isLoading,
    defaultNodeId,
    selectedSpanId,
    nodes,
    onSelectSpan,
    focusedTool,
    autoSelectDefaultNode,
  ]);

  return {selectedNode, handleSelectNode};
}
