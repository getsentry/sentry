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
  const nodes = [createToolNode('span-a', 1000), createToolNode('span-b', 2000)];

  it('auto-selects the default node when enabled and nothing is selected', () => {
    const onSelectSpan = jest.fn();

    const {result} = renderHookWithProviders(() =>
      useConversationSelection({
        nodes,
        selectedSpanId: null,
        onSelectSpan,
        isLoading: false,
        autoSelectDefaultNode: true,
      })
    );

    expect(onSelectSpan).toHaveBeenCalledWith('span-a');
    expect(result.current.selectedNode?.id).toBe('span-a');
  });

  it('does not auto-select when disabled, so an explicit deselect sticks', () => {
    const onSelectSpan = jest.fn();

    const {result} = renderHookWithProviders(() =>
      useConversationSelection({
        nodes,
        selectedSpanId: null,
        onSelectSpan,
        isLoading: false,
        // Mirrors the timeline after the user closes the span detail.
        autoSelectDefaultNode: false,
      })
    );

    expect(onSelectSpan).not.toHaveBeenCalled();
    expect(result.current.selectedNode).toBeUndefined();
  });

  it('resolves an explicitly selected span even with auto-select disabled', () => {
    const onSelectSpan = jest.fn();

    const {result} = renderHookWithProviders(() =>
      useConversationSelection({
        nodes,
        selectedSpanId: 'span-b',
        onSelectSpan,
        isLoading: false,
        autoSelectDefaultNode: false,
      })
    );

    expect(onSelectSpan).not.toHaveBeenCalled();
    expect(result.current.selectedNode?.id).toBe('span-b');
  });
});
