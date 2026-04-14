import {useCallback, useEffect, useMemo} from 'react';

import {getDefaultSelectedNode} from 'sentry/views/insights/pages/agents/utils/getDefaultSelectedNode';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {useFocusedToolSpan} from 'sentry/views/insights/pages/conversations/hooks/useFocusedToolSpan';
import {extractMessagesFromNodes} from 'sentry/views/insights/pages/conversations/utils/conversationMessages';

interface UseConversationSelectionOptions {
  isLoading: boolean;
  nodes: AITraceSpanNode[];
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
}: UseConversationSelectionOptions) {
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

  const handleSelectNode = useCallback(
    (node: AITraceSpanNode) => {
      onSelectSpan?.(node.id);
    },
    [onSelectSpan]
  );

  const defaultNodeId = useMemo(() => {
    const messages = extractMessagesFromNodes(nodes);
    const firstAssistant = messages.find(m => m.role === 'assistant');
    return firstAssistant?.nodeId ?? getDefaultSelectedNode(nodes)?.id;
  }, [nodes]);

  const selectedNode = useMemo(() => {
    return (
      nodes.find(node => node.id === selectedSpanId) ??
      nodes.find(node => node.id === defaultNodeId)
    );
  }, [nodes, selectedSpanId, defaultNodeId]);

  useEffect(() => {
    if (isLoading || !defaultNodeId || focusedTool) {
      return;
    }

    const isCurrentSpanValid =
      selectedSpanId && nodes.some(node => node.id === selectedSpanId);

    if (!isCurrentSpanValid) {
      onSelectSpan?.(defaultNodeId);
    }
  }, [isLoading, defaultNodeId, selectedSpanId, nodes, onSelectSpan, focusedTool]);

  return {selectedNode, handleSelectNode};
}
