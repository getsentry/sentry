import {useMemo} from 'react';

import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getTraceNodeAttribute} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';

/**
 * Tool-call spans don't report token usage, so their output size is approximated
 * from the tool result. The result lives on the full span attributes
 * (`gen_ai.tool.call.result` / `gen_ai.tool.output`), which the conversation
 * list endpoint doesn't return, so it is fetched per tool span. Returns the byte
 * length of the output, or `0` when unavailable.
 */
export function useToolOutputBytes(
  node: AITraceSpanNode,
  traceId: string | undefined
): number {
  const eapValue = isEAPSpanNode(node) ? node.value : null;
  const {data} = useTraceItemDetails({
    traceItemId: eapValue?.event_id ?? '',
    projectId: eapValue ? eapValue.project_id.toString() : '',
    traceId: traceId ?? '',
    traceItemType: TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    timestamp: eapValue?.start_timestamp,
    enabled: Boolean(eapValue) && Boolean(traceId),
  });

  return useMemo(() => {
    const output =
      getTraceNodeAttribute(
        'gen_ai.tool.call.result',
        node,
        undefined,
        data?.attributes
      ) ?? getTraceNodeAttribute('gen_ai.tool.output', node, undefined, data?.attributes);
    return typeof output === 'string' ? new TextEncoder().encode(output).length : 0;
  }, [node, data]);
}
