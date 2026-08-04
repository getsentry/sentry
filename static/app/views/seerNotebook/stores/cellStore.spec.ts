import {InvestigationDetailFixture} from 'sentry-fixture/investigation';

import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';
import type {
  InvestigationComment,
  InvestigationQueryResult,
} from 'sentry/views/seerNotebook/types';

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
      x_axis: 'time',
      visualization: 'area',
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
  const updateCell = jest.fn().mockImplementation((_cellId, data) =>
    Promise.resolve({
      ...detail.cells[0]!,
      ...data,
      version: detail.cells[0]!.version + 1,
    })
  );
  const transport = {
    loadDetail: jest.fn().mockResolvedValue(detail),
    updateCell,
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
  return {cell: store.cellsInOrder[0]!, detail, store, updateCell};
}

describe('CellStore', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('updates the observable draft immediately and autosaves it', async () => {
    const {cell, updateCell} = makeStore();

    cell.editContent('Locally edited Markdown');

    expect(cell.content).toBe('Locally edited Markdown');
    expect(cell.saveState).toBe('scheduled');
    expect(updateCell).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(600);

    expect(updateCell).toHaveBeenCalledWith(
      cell.serverId,
      expect.objectContaining({
        content: 'Locally edited Markdown',
        investigationVersion: 7,
        version: cell.version - 1,
      })
    );
    expect(cell.isDirty).toBe(false);
    expect(cell.saveState).toBe('idle');
  });

  it('keeps failed drafts visible and retryable', async () => {
    const {cell, updateCell} = makeStore();
    updateCell.mockRejectedValueOnce(new Error('offline'));
    cell.editGenerationPrompt('Keep this exact prompt');

    await expect(cell.flush()).rejects.toThrow('offline');

    expect(cell.generationPrompt).toBe('Keep this exact prompt');
    expect(cell.dirtyFields.has('generationPrompt')).toBe(true);
    expect(cell.saveState).toBe('unsaved');
    expect(cell.saveError).toBe('save_failed');
  });

  it('does not let an older save acknowledgement replace newer typing', async () => {
    const {cell, detail, updateCell} = makeStore();
    const first = deferred<(typeof detail.cells)[number]>();
    updateCell
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce((_cellId, data) =>
        Promise.resolve({...detail.cells[0]!, ...data, version: 3})
      );

    cell.editContent('First value');
    const saving = cell.flush();
    await Promise.resolve();
    cell.editContent('Second value');
    first.resolve({...detail.cells[0]!, content: 'First value', version: 2});
    await saving;

    expect(updateCell).toHaveBeenCalledTimes(2);
    expect(cell.content).toBe('Second value');
    expect(cell.isDirty).toBe(false);
  });

  it('preserves dirty fields while reconciling a fresh server snapshot', () => {
    const {cell, detail, store} = makeStore();
    cell.editContent('Unsaved local Markdown');

    store.applyRemoteSnapshot({
      ...detail,
      version: detail.version + 1,
      cells: detail.cells.map(value =>
        value.id === cell.serverId
          ? {...value, content: 'Remote Markdown', outputStatus: 'running'}
          : value
      ),
    });

    expect(cell.content).toBe('Unsaved local Markdown');
    expect(cell.outputStatus).toBe('running');
  });

  it('uses the shorter display debounce and computes the execution intent', async () => {
    const {cell, updateCell} = makeStore();
    cell.editGenerationPrompt('Natural-language intent');
    cell.updateDisplay({...cell.display, defaultView: 'chart'});

    expect(cell.executionIntent).toBe('Natural-language intent');
    await jest.advanceTimersByTimeAsync(399);
    expect(updateCell).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(updateCell).toHaveBeenCalledWith(
      cell.serverId,
      expect.objectContaining({
        display: expect.objectContaining({defaultView: 'chart'}),
        generationPrompt: 'Natural-language intent',
      })
    );
  });

  it('flushes before running and reuses a failed request id only for retry', async () => {
    const {cell, updateCell, store} = makeStore();
    const executeCell = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({id: 'execution-1', status: 'pending'})
      .mockResolvedValueOnce({id: 'execution-2', status: 'pending'});
    store.transport.executeCell = executeCell;
    cell.editGenerationPrompt('Generate a report');

    await expect(cell.run()).rejects.toThrow('offline');

    expect(updateCell).toHaveBeenCalledTimes(1);
    expect(executeCell).toHaveBeenCalledTimes(1);
    expect(cell.outputStatus).toBe('notRun');
    expect(cell.failedRunRequestId).toBeTruthy();
    const failedRequestId = executeCell.mock.calls[0]![1].requestId;

    await cell.retryRun();
    expect(executeCell.mock.calls[1]![1].requestId).toBe(failedRequestId);
    expect(cell.outputStatus).toBe('pending');

    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
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
    await cell.run();
    expect(executeCell.mock.calls[2]![1].requestId).not.toBe(failedRequestId);
  });

  it('does not regress a terminal execution from an older running snapshot', () => {
    const {cell} = makeStore();
    const execution = {
      completedAt: '2026-08-03T00:00:00Z',
      error: null,
      executor: 'seer',
      id: 'execution-1',
      schemaVersion: 1,
      startedAt: '2026-08-03T00:00:00Z',
      status: 'completed',
    };
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      currentExecution: execution,
      output: {table: 'result'},
      outputStatus: 'available',
    });

    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      currentExecution: {...execution, completedAt: null, status: 'running'},
      output: null,
      outputStatus: 'running',
    });

    expect(cell.outputStatus).toBe('available');
    expect(cell.output).toEqual({table: 'result'});
  });

  it('owns table and chart result views', () => {
    const {cell} = makeStore();
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: queryResult(),
      outputStatus: 'available',
    });

    cell.setResultView('chart');
    expect(cell.effectiveView).toBe('chart');
    cell.setResultView('table');
    expect(cell.effectiveView).toBe('table');
  });

  it('owns the preferred-chart fallback state', () => {
    const {cell} = makeStore();
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      config: {preferChart: true},
      output: {
        ...queryResult(),
        chart: null,
        chartUnavailableReason: 'The chart renderer failed.',
      },
      outputStatus: 'available',
    });

    expect(cell.effectiveView).toBe('table');
    expect(cell.chartFallbackWarning).toBe('The chart renderer failed.');
  });

  it('persists chart presentation changes without changing data', () => {
    const {cell} = makeStore();
    const output = queryResult();
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      output,
      outputStatus: 'available',
    });
    cell.applyVisualizationChange({type: 'bar', title: 'Errors by time'});
    expect(cell.display.type).toBe('bar');
    expect(cell.display.title).toBe('Errors by time');
  });

  it('shows debuggable tool calls but hides internal and stale loading blocks', () => {
    const {cell} = makeStore();
    cell.applyExecutionState({
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

    expect(cell.activityEntries).toEqual([
      expect.objectContaining({
        id: 'tool',
        policyError: 'Unsupported Sentry API call: sentry.get_issue.',
        calls: [expect.objectContaining({code: 'sentry.get_issue(issue_id=1)'})],
      }),
    ]);
  });

  it('briefly surfaces new activity before resuming rotating working labels', async () => {
    const {cell} = makeStore();

    cell.applyExecutionState({
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

    expect(cell.activityExpanded).toBe(false);
    expect(cell.executionStatusLabel).toBe('Querying your telemetry');

    await jest.advanceTimersByTimeAsync(3500);
    expect(cell.executionStatusLabel).toBe('Thinking');

    await jest.advanceTimersByTimeAsync(100);
    expect(cell.executionStatusLabel).toBe('Investigating');

    cell.applyExecutionState({
      id: 'execution-1',
      status: 'failed',
      error: {message: 'Telemetry failed'},
      partialMarkdown: null,
      pendingUserInput: null,
      transcriptTruncated: false,
      blocks: [],
    });
    expect(cell.executionStatusLabel).toBe('Stopped because of an error');
  });

  it('optimistically manages comments while preserving failed composer drafts', async () => {
    const {cell, store} = makeStore();
    const comment: InvestigationComment = {
      author: '1',
      body: 'Existing',
      dateCreated: '2026-08-03T00:00:00Z',
      dateUpdated: '2026-08-03T00:00:00Z',
      deletedAt: null,
      id: 'comment-1',
      mentions: [],
      reactions: [],
    };
    store.transport.loadComments = jest
      .fn()
      .mockResolvedValue({items: [comment], nextCursor: 'next'});
    await cell.loadComments();
    expect(cell.comments).toEqual([comment]);
    expect(cell.commentsNextCursor).toBe('next');

    const creation = deferred<InvestigationComment>();
    store.transport.createComment = jest.fn().mockReturnValue(creation.promise);
    const creating = cell.createComment('Keep this draft', []);
    expect(cell.comments.at(-1)?.id).toContain('optimistic-comment-');
    expect(cell.commentCount).toBeGreaterThan(0);
    creation.reject(new Error('offline'));
    await expect(creating).rejects.toThrow('offline');

    expect(cell.commentDraft).toBe('Keep this draft');
    expect(cell.comments).toEqual([comment]);
    expect(cell.commentMutationError).toBe('comment_create_failed');
  });

  it('conditionally rolls back failed cell reactions', async () => {
    const {cell, store} = makeStore();
    store.transport.setCellReaction = jest.fn().mockRejectedValue(new Error('offline'));

    const toggling = cell.toggleReaction('heart', true);
    expect(cell.reactions).toContainEqual({
      reaction: 'heart',
      count: 1,
      reactedByMe: true,
    });
    await expect(toggling).rejects.toThrow('offline');

    expect(cell.reactions).not.toContainEqual(
      expect.objectContaining({reaction: 'heart'})
    );
    expect(cell.reactionError).toBe('reaction_failed');
  });
});
