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
    query: {
      dataset: 'errors',
      query: 'is:unresolved',
      mode: 'aggregates',
      fields: [],
      yAxes: ['count()'],
      groupBy: [],
      sort: '',
      timeRange: {statsPeriod: '24h'},
      projectIds: [1],
      projectSlugs: ['frontend'],
      linkParams: {},
    },
    table: {
      columns: [{key: 'count()', label: 'Errors', type: 'number'}],
      rows: [[12]],
      totalRows: 1,
      returnedRows: 1,
      truncated: false,
    },
    chart: {
      xAxis: 'time',
      truncated: false,
      series: [{name: 'count()', data: [{x: '2026-08-03T00:00:00Z', y: 12}]}],
    },
    suggestedVisualization: {
      type: 'area',
      title: 'Errors',
      xField: 'timestamp',
      yFields: ['count()'],
      unit: 'number',
      stacked: false,
      showLegend: true,
      sort: 'none',
    },
    chartUnavailableReason: null,
    warnings: [],
    dataProjectIds: [1],
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
    cell.updateDisplay({...cell.display, defaultView: 'both'});

    expect(cell.executionIntent).toBe('Natural-language intent');
    await jest.advanceTimersByTimeAsync(399);
    expect(updateCell).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(updateCell).toHaveBeenCalledWith(
      cell.serverId,
      expect.objectContaining({
        display: expect.objectContaining({defaultView: 'both'}),
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

  it('owns result views and retains the last valid visualization', () => {
    const {cell} = makeStore();
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      display: {version: 1, type: 'table', defaultView: 'table'},
      output: queryResult(),
      outputStatus: 'available',
    });

    cell.setResultView('chart');
    expect(cell.effectiveView).toBe('chart');
    expect(cell.chartData).toHaveLength(1);

    const previousDisplay = cell.display;
    const previousVisualization = cell.visualizationResolution.visualization;
    cell.applyVisualizationChange({yAxes: ['missing()']});

    expect(cell.visualizationError).toBe('unavailable_y_axis');
    expect(cell.display).toBe(previousDisplay);
    expect(cell.visualizationResolution.visualization).toEqual(previousVisualization);
  });

  it('applies display-only suggestions and defers data-changing suggestions', async () => {
    const {cell, store} = makeStore();
    const output = queryResult();
    cell.applyServerSnapshot({
      ...cell.toInvestigationCell(),
      output,
      outputStatus: 'available',
    });
    store.transport.suggestVisualization = jest
      .fn()
      .mockResolvedValueOnce({
        existingResultSufficient: true,
        visualization: {...output.suggestedVisualization!, type: 'bar'},
      })
      .mockResolvedValueOnce({
        existingResultSufficient: false,
        revisedQueryIntent: 'Group errors by release',
        visualization: output.suggestedVisualization!,
      });

    cell.editVisualizationPrompt('Make it a bar chart');
    await cell.requestVisualizationSuggestion();
    expect(cell.display.type).toBe('bar');
    expect(cell.revisedQueryIntent).toBeNull();

    cell.editVisualizationPrompt('Group it by release');
    await cell.requestVisualizationSuggestion();
    expect(cell.revisedQueryIntent).toBe('Group errors by release');
    expect(store.transport.executeCell).toBeUndefined();
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
