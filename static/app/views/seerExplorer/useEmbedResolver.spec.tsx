import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Block, ToolResult} from 'sentry/views/seerExplorer/types';
import {useEmbedResolver} from 'sentry/views/seerExplorer/useEmbedResolver';

const CHART = {
  title: 'Error volume',
  series: [{label: 'Errors', data: [{x: '2026-07-30T12:00:00Z', y: 12}]}],
};
const LATENCY = {...CHART, title: 'Latency'};

function block(id: string, lane?: ToolResult['structuredContent']): Block {
  return {
    id,
    timestamp: '2026-07-30T12:00:00Z',
    message: {content: null, role: 'tool_use'},
    tool_results: lane
      ? [
          {
            content: '{% chart /%}',
            tool_call_function: 'sentry_api_execute',
            tool_call_id: `call-${id}`,
            structuredContent: lane,
          },
        ]
      : undefined,
  };
}

describe('useEmbedResolver', () => {
  it('resolves a payload from the block that produced it', () => {
    const {result} = renderHook(() =>
      useEmbedResolver([block('blk-9', {chart: [{key: 'a3f', data: CHART}]})])
    );
    expect(result.current('blk-9', 'chart', 'a3f')).toEqual(CHART);
  });

  it('resolves across blocks, so a later answer reaches an earlier tool result', () => {
    const {result} = renderHook(() =>
      useEmbedResolver([
        block('blk-1', {chart: [{key: 'aaa', data: CHART}]}),
        block('blk-2'),
        block('blk-3', {chart: [{key: 'bbb', data: LATENCY}]}),
      ])
    );
    expect(result.current('blk-1', 'chart', 'aaa')).toEqual(CHART);
    expect(result.current('blk-3', 'chart', 'bbb')).toEqual(LATENCY);
  });

  it('keeps keys from different blocks apart', () => {
    const {result} = renderHook(() =>
      useEmbedResolver([
        block('blk-1', {chart: [{key: 'same', data: CHART}]}),
        block('blk-2', {chart: [{key: 'same', data: LATENCY}]}),
      ])
    );
    expect(result.current('blk-1', 'chart', 'same')).toEqual(CHART);
    expect(result.current('blk-2', 'chart', 'same')).toEqual(LATENCY);
  });

  it('indexes several tool results in one block', () => {
    // Parallel tool calls each drain their own lane; both are addressable against the block.
    const parallel = block('blk-9', {chart: [{key: 'aaa', data: CHART}]});
    parallel.tool_results = [
      ...parallel.tool_results!,
      {
        content: '{% chart /%}',
        tool_call_function: 'sentry_api_execute',
        tool_call_id: 'call-b',
        structuredContent: {chart: [{key: 'bbb', data: LATENCY}]},
      },
    ];
    const {result} = renderHook(() => useEmbedResolver([parallel]));
    expect(result.current('blk-9', 'chart', 'aaa')).toEqual(CHART);
    expect(result.current('blk-9', 'chart', 'bbb')).toEqual(LATENCY);
  });

  it('returns undefined for an unknown address', () => {
    const {result} = renderHook(() => useEmbedResolver([block('blk-9')]));
    expect(result.current('blk-9', 'chart', 'a3f')).toBeUndefined();
  });

  it('ignores non-lane structuredContent keys', () => {
    // `todos` and `links` share the channel but are not addressable embeds.
    const {result} = renderHook(() =>
      useEmbedResolver([block('blk-9', {todos: [{content: 'x', status: 'pending'}]})])
    );
    expect(result.current('blk-9', 'todos', '0')).toBeUndefined();
  });
});
