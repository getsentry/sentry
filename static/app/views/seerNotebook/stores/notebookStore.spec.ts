import {runInAction} from 'mobx';
import {InvestigationDetailFixture} from 'sentry-fixture/investigation';

import {RequestError} from 'sentry/utils/requestError/requestError';
import {NotebookStore} from 'sentry/views/seerNotebook/stores/notebookStore';
import type {InvestigationTransport} from 'sentry/views/seerNotebook/stores/types';
import type {InvestigationDetail} from 'sentry/views/seerNotebook/types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}

function makeStore(
  detail: InvestigationDetail,
  overrides: Partial<InvestigationTransport> = {}
) {
  let id = 0;
  const transport = {
    loadDetail: jest.fn().mockResolvedValue(detail),
    ...overrides,
  } as InvestigationTransport;
  return {
    store: new NotebookStore({
      idGenerator: () => `operation-${id++}`,
      investigationId: detail.id,
      organizationSlug: 'sentry',
      queryExecutionEnabled: true,
      transport,
    }),
    transport,
  };
}

describe('NotebookStore', () => {
  it('hydrates one stable CellStore per cell', async () => {
    const detail = InvestigationDetailFixture();
    const {store} = makeStore(detail);

    await store.load();

    expect(store.loadState).toBe('ready');
    expect(store.cellsInOrder).toHaveLength(detail.cells.length);
    const original = store.cellsInOrder[0]!;
    const updated = {
      ...detail,
      version: detail.version + 1,
      cells: detail.cells.map((cell, index) =>
        index === 0 ? {...cell, title: 'Updated on the server', version: 2} : cell
      ),
    };

    store.applyRemoteSnapshot(updated);

    expect(store.cellsInOrder[0]).toBe(original);
    expect(original.title).toBe('Updated on the server');
    expect(store.toSnapshot()).toMatchObject({
      investigationId: detail.id,
      loadState: 'ready',
      version: detail.version + 1,
    });
  });

  it('serializes remote operations through the notebook version', async () => {
    const detail = InvestigationDetailFixture({version: 7});
    const {store} = makeStore(detail);
    await store.load();
    const first = deferred<string>();
    const second = deferred<string>();
    const versions: number[] = [];

    const firstOperation = store.enqueueOperation({
      affectedFields: new Set(['title']),
      execute: version => {
        versions.push(version);
        return first.promise;
      },
      failurePolicy: 'rollback',
      kind: 'first',
      onCommit: () => {
        store.version += 1;
      },
    });
    const secondOperation = store.enqueueOperation({
      affectedFields: new Set(['filters']),
      execute: version => {
        versions.push(version);
        return second.promise;
      },
      failurePolicy: 'rollback',
      kind: 'second',
      onCommit: () => {
        store.version += 1;
      },
    });

    await Promise.resolve();
    expect(versions).toEqual([7]);
    expect(store.isSaving).toBe(true);

    first.resolve('first');
    await firstOperation;
    await Promise.resolve();
    expect(versions).toEqual([7, 8]);

    second.resolve('second');
    await secondOperation;
    expect(store.version).toBe(9);
    expect(store.isSaving).toBe(false);
  });

  it('conditionally rolls back atomic failures but retains drafts', async () => {
    const detail = InvestigationDetailFixture({title: 'Confirmed title'});
    const {store} = makeStore(detail);
    await store.load();

    runInAction(() => {
      store.title = 'Optimistic title';
    });
    await expect(
      store.enqueueOperation({
        affectedFields: new Set(['title']),
        execute: () => Promise.reject(new Error('nope')),
        failurePolicy: 'rollback',
        kind: 'rename',
        onCommit: () => {},
        onRollback: () => {
          store.title = 'Confirmed title';
        },
      })
    ).rejects.toThrow('nope');
    expect(store.title).toBe('Confirmed title');

    runInAction(() => {
      store.titleDraft = 'Unsaved user title';
    });
    await expect(
      store.enqueueOperation({
        affectedFields: new Set(['titleDraft']),
        execute: () => Promise.reject(new Error('offline')),
        failurePolicy: 'retain-draft',
        kind: 'title-draft',
        onCommit: () => {},
      })
    ).rejects.toThrow('offline');
    expect(store.titleDraft).toBe('Unsaved user title');
    expect(store.mutationError).toBe('unsaved');
  });

  it('preserves the optimistic projection on a version conflict', async () => {
    const detail = InvestigationDetailFixture({title: 'Confirmed'});
    const {store} = makeStore(detail);
    await store.load();
    const conflict = new RequestError(
      'PUT',
      '/investigations/id/',
      new Error('conflict')
    );
    conflict.status = 409;
    runInAction(() => {
      store.title = 'Local title';
    });

    await expect(
      store.enqueueOperation({
        affectedFields: new Set(['title']),
        execute: () => Promise.reject(conflict),
        failurePolicy: 'retain-draft',
        kind: 'rename',
        onCommit: () => {},
      })
    ).rejects.toBe(conflict);

    expect(store.title).toBe('Local title');
    expect(store.conflict).toMatchObject({operationKind: 'rename'});
    expect(store.isSaving).toBe(true);
  });

  it('hydrates running executions and polls until they are terminal', async () => {
    jest.useFakeTimers();
    const base = InvestigationDetailFixture();
    const running = {
      ...base,
      cells: base.cells.map((cell, index) =>
        index === 0
          ? {
              ...cell,
              currentExecution: {
                completedAt: null,
                error: null,
                executor: 'seer',
                id: 'execution-1',
                schemaVersion: 1,
                startedAt: '2026-08-03T00:00:00Z',
                status: 'running',
              },
              outputStatus: 'running',
            }
          : cell
      ),
    };
    const completed = {
      ...running,
      cells: running.cells.map((cell, index) =>
        index === 0
          ? {
              ...cell,
              currentExecution: {...cell.currentExecution!, status: 'completed'},
              output: {table: 'result'},
              outputStatus: 'available',
            }
          : cell
      ),
    };
    const {store, transport} = makeStore(running, {
      loadDetail: jest.fn().mockResolvedValueOnce(running).mockResolvedValue(completed),
    });

    await store.load();
    expect(store.hasPendingExecution).toBe(true);
    await jest.advanceTimersByTimeAsync(1500);

    expect(transport.loadDetail).toHaveBeenCalledTimes(2);
    expect(store.cellsInOrder[0]!.outputStatus).toBe('available');
    expect(store.hasPendingExecution).toBe(false);
    store.dispose();
    jest.useRealTimers();
  });

  it('ignores an older detail refresh that finishes last', async () => {
    const detail = InvestigationDetailFixture({title: 'Initial'});
    const older = deferred<InvestigationDetail>();
    const newer = deferred<InvestigationDetail>();
    const loadDetail = jest
      .fn()
      .mockResolvedValueOnce(detail)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const {store} = makeStore(detail, {loadDetail});
    await store.load();

    const firstRefresh = store.refreshDetail();
    const secondRefresh = store.refreshDetail();
    newer.resolve({...detail, title: 'Newer', version: detail.version + 2});
    await secondRefresh;
    older.resolve({...detail, title: 'Older', version: detail.version + 1});
    await firstRefresh;

    expect(store.title).toBe('Newer');
  });
});
