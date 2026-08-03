import {InvestigationDetailFixture} from 'sentry-fixture/investigation';

import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
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
});
