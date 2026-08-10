import {InvestigationDetailFixture} from 'sentry-fixture/investigation';

import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';
import type {InvestigationQueryResult} from 'sentry/views/seerNotebook/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}

function queryResult(): InvestigationQueryResult {
  return {
    schemaVersion: 1,
    tableMarkdown: '| Errors |\n| ---: |\n| 12 |',
    chart: {
      title: 'Errors over time',
      x_axis: 'time',
      y_axis_unit: 'number',
      visualization: 'area',
      stacked: true,
      show_legend: true,
      show_title: true,
      frameless: false,
      series: [{name: 'count()', data: [{x: '2026-08-03T00:00:00Z', y: 12}]}],
    },
    preferredView: 'chart',
    isEmpty: false,
    chartUnavailableReason: null,
    queryLinks: [],
  };
}

function makeStore() {
  const detail = InvestigationDetailFixture({version: 7});
  const updateBlock = jest.fn().mockImplementation((_blockId, data) =>
    Promise.resolve({
      ...detail.blocks[0]!,
      ...data,
      version: detail.blocks[0]!.version + 1,
    })
  );
  const transport = {
    loadDetail: jest.fn().mockResolvedValue(detail),
    updateBlock,
  } as unknown as InvestigationTransport;
  let id = 0;
  const store = new NotebookStore({
    idGenerator: () => `operation-${id++}`,
    investigationId: detail.id,
    organizationSlug: 'sentry',
    queryExecutionEnabled: true,
    transport,
  });
  store.applyRemoteSnapshot(detail);
  return {block: store.blocksInOrder[0]!, detail, store, updateBlock};
}

describe('BlockStore', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('updates the observable draft immediately and autosaves it', async () => {
    const {block, updateBlock} = makeStore();

    block.editContent('Locally edited Markdown');

    expect(block.content).toBe('Locally edited Markdown');
    expect(block.saveState).toBe('scheduled');
    expect(updateBlock).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(600);

    expect(updateBlock).toHaveBeenCalledWith(
      block.serverId,
      expect.objectContaining({
        content: 'Locally edited Markdown',
        investigationVersion: 7,
        version: block.version - 1,
      })
    );
    expect(block.isDirty).toBe(false);
    expect(block.saveState).toBe('idle');
  });

  it('keeps failed drafts visible and retryable', async () => {
    const {block, updateBlock} = makeStore();
    updateBlock.mockRejectedValueOnce(new Error('offline'));
    block.editGenerationPrompt('Keep this exact prompt');

    await expect(block.flush()).rejects.toThrow('offline');

    expect(block.generationPrompt).toBe('Keep this exact prompt');
    expect(block.dirtyFields.has('generationPrompt')).toBe(true);
    expect(block.saveState).toBe('unsaved');
    expect(block.saveError).toBe('save_failed');
  });

  it('does not let an older save acknowledgement replace newer typing', async () => {
    const {block, detail, updateBlock} = makeStore();
    const first = deferred<(typeof detail.blocks)[number]>();
    updateBlock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce((_blockId, data) =>
        Promise.resolve({...detail.blocks[0]!, ...data, version: 3})
      );

    block.editContent('First value');
    const saving = block.flush();
    await Promise.resolve();
    block.editContent('Second value');
    first.resolve({...detail.blocks[0]!, content: 'First value', version: 2});
    await saving;

    expect(updateBlock).toHaveBeenCalledTimes(2);
    expect(block.content).toBe('Second value');
    expect(block.isDirty).toBe(false);
  });

  it('preserves dirty fields while reconciling a fresh server snapshot', () => {
    const {block, detail, store} = makeStore();
    block.editContent('Unsaved local Markdown');

    store.applyRemoteSnapshot({
      ...detail,
      version: detail.version + 1,
      blocks: detail.blocks.map(value =>
        value.id === block.serverId
          ? {...value, content: 'Remote Markdown', outputStatus: 'running'}
          : value
      ),
    });

    expect(block.content).toBe('Unsaved local Markdown');
    expect(block.outputStatus).toBe('running');
  });

  it('uses the shorter display debounce and computes the execution intent', async () => {
    const {block, updateBlock} = makeStore();
    block.editGenerationPrompt('Natural-language intent');
    block.updateDisplay({...block.display, defaultView: 'chart'});

    expect(block.executionIntent).toBe('Natural-language intent');
    await jest.advanceTimersByTimeAsync(399);
    expect(updateBlock).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(updateBlock).toHaveBeenCalledWith(
      block.serverId,
      expect.objectContaining({
        display: expect.objectContaining({defaultView: 'chart'}),
        generationPrompt: 'Natural-language intent',
      })
    );
  });

  it('flushes before running and reuses a failed request id only for retry', async () => {
    const {block, updateBlock, store} = makeStore();
    const executeBlock = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({id: 'execution-1', status: 'pending'})
      .mockResolvedValueOnce({id: 'execution-2', status: 'pending'});
    store.transport.executeBlock = executeBlock;
    block.editGenerationPrompt('Generate a report');

    await expect(block.run()).rejects.toThrow('offline');

    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(executeBlock).toHaveBeenCalledTimes(1);
    expect(block.outputStatus).toBe('notRun');
    expect(block.failedRunRequestId).toBeTruthy();
    const failedRequestId = executeBlock.mock.calls[0]![1].requestId;

    await block.retryRun();
    expect(executeBlock.mock.calls[1]![1].requestId).toBe(failedRequestId);
    expect(block.outputStatus).toBe('pending');

    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      currentExecution: {
        completedAt: '2026-08-03T00:00:00Z',
        error: null,
        executor: 'seer',
        id: 'execution-1',
        schemaVersion: 1,
        startedAt: '2026-08-03T00:00:00Z',
        status: 'completed',
      },
      outputStatus: 'available',
    });
    await block.run();
    expect(executeBlock.mock.calls[2]![1].requestId).not.toBe(failedRequestId);
  });

  it('does not regress a terminal execution from an older running snapshot', () => {
    const {block} = makeStore();
    const execution = {
      completedAt: '2026-08-03T00:00:00Z',
      error: null,
      executor: 'seer',
      id: 'execution-1',
      schemaVersion: 1,
      startedAt: '2026-08-03T00:00:00Z',
      status: 'completed',
    };
    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      currentExecution: execution,
      output: {table: 'result'},
      outputStatus: 'available',
    });

    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      currentExecution: {...execution, completedAt: null, status: 'running'},
      output: null,
      outputStatus: 'running',
    });

    expect(block.outputStatus).toBe('available');
    expect(block.output).toEqual({table: 'result'});
  });

  it('owns table and chart result views', () => {
    const {block} = makeStore();
    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: queryResult(),
      outputStatus: 'available',
    });

    block.setResultView('chart');
    expect(block.effectiveView).toBe('chart');
    block.setResultView('table');
    expect(block.effectiveView).toBe('table');
  });

  it('owns the preferred-chart fallback state', () => {
    const {block} = makeStore();
    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      config: {preferChart: true},
      output: {
        ...queryResult(),
        chart: null,
        chartUnavailableReason: 'The chart renderer failed.',
      },
      outputStatus: 'available',
    });

    expect(block.effectiveView).toBe('table');
    expect(block.chartFallbackWarning).toBe('The chart renderer failed.');
  });

  it('persists chart presentation changes without changing data', () => {
    const {block} = makeStore();
    const output = queryResult();
    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      output,
      outputStatus: 'available',
    });
    block.applyVisualizationChange({type: 'bar', title: 'Errors by time'});
    expect(block.display.type).toBe('bar');
    expect(block.display.title).toBe('Errors by time');
  });

  it('only offers bars for category charts', () => {
    const {block} = makeStore();
    const output = queryResult();
    block.applyServerSnapshot({
      ...block.toInvestigationBlock(),
      display: {type: 'line'},
      output: {
        ...output,
        chart: {...output.chart!, x_axis: 'category', visualization: 'bar'},
      },
      outputStatus: 'available',
    });

    expect(block.compatibleChartTypes).toEqual(['bar']);
    expect(block.chartEmbedData?.visualization).toBe('bar');
  });

  it('shows debuggable tool calls but hides internal and stale loading blocks', () => {
    const {block} = makeStore();
    block.applyExecutionState({
      id: 'execution-1',
      status: 'failed',
      error: {message: 'Unsupported Sentry API call: sentry.get_issue.'},
      partialMarkdown: null,
      pendingUserInput: null,
      transcriptTruncated: false,
      blocks: [
        {
          id: 'prompt',
          loading: false,
          message: {role: 'user', content: 'Internal instructions'},
        },
        {
          id: 'tool',
          loading: false,
          message: {
            role: 'tool_use',
            tool_calls: [
              {
                function: 'sentry_api_execute',
                args: '{"code":"sentry.get_issue(issue_id=1)"}',
              },
            ],
          },
          policyError: 'Unsupported Sentry API call: sentry.get_issue.',
          toolResults: [{content: '[Result hidden]'}],
        },
        {
          id: 'loading',
          loading: true,
          message: {role: 'assistant', content: 'Thinking...'},
        },
      ],
    });

    expect(block.activityEntries).toEqual([
      expect.objectContaining({
        id: 'tool',
        policyError: 'Unsupported Sentry API call: sentry.get_issue.',
        calls: [expect.objectContaining({code: 'sentry.get_issue(issue_id=1)'})],
      }),
    ]);
    expect(block.hasExecutionFooter).toBe(true);
  });

  it('briefly surfaces new activity before resuming rotating working labels', async () => {
    const {block} = makeStore();

    block.applyExecutionState({
      id: 'execution-1',
      status: 'running',
      error: null,
      partialMarkdown: null,
      pendingUserInput: null,
      transcriptTruncated: false,
      blocks: [
        {
          id: 'tool',
          loading: false,
          message: {
            role: 'tool_use',
            tool_calls: [
              {
                function: 'sentry_api_execute',
                args: '{"code":"sentry.telemetry_live_search()"}',
              },
            ],
          },
          toolResults: [{content: 'Searching'}],
        },
      ],
    });

    expect(block.activityExpanded).toBe(false);
    expect(block.executionStatusLabel).toBe('Querying your telemetry');

    await jest.advanceTimersByTimeAsync(3500);
    expect(block.executionStatusLabel).toBe('Thinking');

    await jest.advanceTimersByTimeAsync(100);
    expect(block.executionStatusLabel).toBe('Investigating');

    block.applyExecutionState({
      id: 'execution-1',
      status: 'failed',
      error: {message: 'Telemetry failed'},
      partialMarkdown: null,
      pendingUserInput: null,
      transcriptTruncated: false,
      blocks: [],
    });
    expect(block.executionStatusLabel).toBe('Stopped because of an error');
  });
});
