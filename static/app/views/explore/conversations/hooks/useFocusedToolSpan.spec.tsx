import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

import {useFocusedToolSpan} from './useFocusedToolSpan';

function createToolNode({id, toolName}: {id: string; toolName: string}) {
  return {
    id,
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
    },
  } as unknown as AITraceSpanNode;
}

describe('useFocusedToolSpan', () => {
  it('processes each focused tool change within the same hook instance', () => {
    const onSpanFound = jest.fn();
    const nodes: AITraceSpanNode[] = [
      createToolNode({id: 'span-a', toolName: 'first-tool'}),
      createToolNode({id: 'span-b', toolName: 'second-tool'}),
    ];

    const {rerender} = renderHook(
      ({focusedTool}) =>
        useFocusedToolSpan({
          nodes,
          focusedTool,
          isLoading: false,
          onSpanFound,
        }),
      {
        initialProps: {focusedTool: 'first-tool' as string | null},
      }
    );

    expect(onSpanFound).toHaveBeenNthCalledWith(1, 'span-a');
    expect(onSpanFound).toHaveBeenCalledTimes(1);

    // Matches how the drawer clears focusedTool after selecting the span.
    rerender({focusedTool: null});
    expect(onSpanFound).toHaveBeenCalledTimes(1);

    // Clicking another tool tag should focus that new tool span.
    rerender({focusedTool: 'second-tool'});
    expect(onSpanFound).toHaveBeenNthCalledWith(2, 'span-b');
    expect(onSpanFound).toHaveBeenCalledTimes(2);
  });
});
