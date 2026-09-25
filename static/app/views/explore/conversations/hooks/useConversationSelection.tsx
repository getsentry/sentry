import {useCallback, useMemo} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useFocusedToolSpan} from 'sentry/views/explore/conversations/hooks/useFocusedToolSpan';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface UseConversationSelectionOptions {
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  focusedTool?: string | null;
  onSelectSpan?: (spanId: string) => void;
  selectedSpanId?: string | null;
}

/**
 * Resolves explicit span selection and handles focused-tool links and user clicks.
 */
export function useConversationSelection({
  nodes,
  selectedSpanId,
  onSelectSpan,
  focusedTool,
  isLoading,
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

  const selectedNode = useMemo(
    () => nodes.find(node => node.id === selectedSpanId),
    [nodes, selectedSpanId]
  );

  return {selectedNode, handleSelectNode};
}
