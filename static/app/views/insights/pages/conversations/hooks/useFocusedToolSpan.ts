import {useEffect, useRef} from 'react';

import {getIsExecuteToolSpan} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

interface UseFocusedToolSpanOptions {
  focusedTool: string | null;
  isLoading: boolean;
  nodes: AITraceSpanNode[];
  onSpanFound: (spanId: string) => void;
}

/**
 * Hook to find and select a span by tool name when opening the conversation drawer.
 * When focusedTool is provided, this hook finds the first execute_tool span with
 * a matching tool name and calls onSpanFound with its ID.
 */
export function useFocusedToolSpan({
  nodes,
  focusedTool,
  isLoading,
  onSpanFound,
}: UseFocusedToolSpanOptions) {
  const hasProcessed = useRef(false);

  useEffect(() => {
    hasProcessed.current = false;
  }, [focusedTool]);

  useEffect(() => {
    if (isLoading || !focusedTool || hasProcessed.current) {
      return;
    }

    const toolSpan = nodes.find(node => {
      const opType = node.attributes?.[SpanFields.GEN_AI_OPERATION_TYPE] as
        | string
        | undefined;
      const toolName = node.attributes?.[SpanFields.GEN_AI_TOOL_NAME] as
        | string
        | undefined;
      return getIsExecuteToolSpan(opType) && toolName === focusedTool;
    });

    if (toolSpan) {
      hasProcessed.current = true;
      onSpanFound(toolSpan.id);
    }
  }, [isLoading, focusedTool, nodes, onSpanFound]);
}
