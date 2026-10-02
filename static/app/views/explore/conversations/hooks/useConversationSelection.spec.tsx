import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {useConversationSelection} from './useConversationSelection';

function createToolNode(id: string, startTimestamp = 1000): AITraceSpanNode {
  const end = startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.execute_tool',
    startTimestamp,
    endTimestamp: end,
    value: {start_timestamp: startTimestamp, end_timestamp: end},
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: `tool-${id}`,
    },
    errors: new Set(),
  } as unknown as AITraceSpanNode;
}

describe('useConversationSelection', () => {
  const nodes = [createToolNode('span-a'), createToolNode('span-b', 2000)];

  it('does not auto-select, so an explicit deselect sticks', () => {
    const onSelectSpan = jest.fn();

    const {result} = renderHookWithProviders(() =>
      useConversationSelection({
        nodes,
        selectedSpanId: null,
        onSelectSpan,
        isLoading: false,
      })
    );

    expect(onSelectSpan).not.toHaveBeenCalled();
    expect(result.current.selectedNode).toBeUndefined();
  });

  it('resolves an explicitly selected span', () => {
    const onSelectSpan = jest.fn();

    const {result} = renderHookWithProviders(() =>
      useConversationSelection({
        nodes,
        selectedSpanId: 'span-b',
        onSelectSpan,
        isLoading: false,
      })
    );

    expect(onSelectSpan).not.toHaveBeenCalled();
    expect(result.current.selectedNode?.id).toBe('span-b');
  });
});
