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
});
