import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

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

  it.each([null, 'missing-span'])(
    'does not replace selection %s with a default',
    selectedSpanId => {
      const onSelectSpan = jest.fn();

      const {result} = renderHookWithProviders(() =>
        useConversationSelection({
          nodes,
          selectedSpanId,
          onSelectSpan,
          isLoading: false,
        })
      );

      expect(onSelectSpan).not.toHaveBeenCalled();
      expect(result.current.selectedNode).toBeUndefined();
    }
  );

  it('resolves an explicit selection and keeps an explicit deselection', () => {
    const onSelectSpan = jest.fn();
    const {result, rerender} = renderHookWithProviders(
      ({selectedSpanId}) =>
        useConversationSelection({
          nodes,
          selectedSpanId,
          onSelectSpan,
          isLoading: false,
        }),
      {initialProps: {selectedSpanId: 'span-b' as string | null}}
    );

    expect(result.current.selectedNode).toBe(nodes[1]);
    rerender({selectedSpanId: null});
    expect(result.current.selectedNode).toBeUndefined();
    expect(onSelectSpan).not.toHaveBeenCalled();
  });

  it('resolves a deep-linked span when nodes finish loading', () => {
    const onSelectSpan = jest.fn();
    const {result, rerender} = renderHookWithProviders(
      ({loadedNodes, isLoading}) =>
        useConversationSelection({
          nodes: loadedNodes,
          selectedSpanId: 'span-b',
          onSelectSpan,
          isLoading,
        }),
      {initialProps: {loadedNodes: [] as AITraceSpanNode[], isLoading: true}}
    );

    expect(result.current.selectedNode).toBeUndefined();
    rerender({loadedNodes: nodes, isLoading: false});
    expect(result.current.selectedNode).toBe(nodes[1]);
    expect(onSelectSpan).not.toHaveBeenCalled();
  });

  it('focuses a tool once loading finishes', () => {
    const onSelectSpan = jest.fn();
    const {rerender} = renderHookWithProviders(
      ({isLoading}) =>
        useConversationSelection({
          nodes,
          focusedTool: 'tool-span-b',
          onSelectSpan,
          isLoading,
        }),
      {initialProps: {isLoading: true}}
    );

    expect(onSelectSpan).not.toHaveBeenCalled();
    rerender({isLoading: false});
    expect(onSelectSpan).toHaveBeenCalledTimes(1);
    expect(onSelectSpan).toHaveBeenCalledWith('span-b');
  });

  it('forwards user selection to the caller', () => {
    const onSelectSpan = jest.fn();
    const node = createToolNode('clicked-span');
    const {result} = renderHookWithProviders(() =>
      useConversationSelection({nodes, onSelectSpan, isLoading: false})
    );

    act(() => result.current.handleSelectNode(node));
    expect(onSelectSpan).toHaveBeenCalledTimes(1);
    expect(onSelectSpan).toHaveBeenCalledWith('clicked-span');
  });
});
