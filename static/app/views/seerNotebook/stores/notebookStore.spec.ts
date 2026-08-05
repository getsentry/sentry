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
  it('hydrates one stable BlockStore per block', async () => {
    const detail = InvestigationDetailFixture();
    const {store} = makeStore(detail);

    await store.load();

    expect(store.loadState).toBe('ready');
    expect(store.blocksInOrder).toHaveLength(detail.blocks.length);
    const original = store.blocksInOrder[0]!;
    const updated = {
      ...detail,
      version: detail.version + 1,
      blocks: detail.blocks.map((block, index) =>
        index === 0 ? {...block, title: 'Updated on the server', version: 2} : block
      ),
    };

    store.applyRemoteSnapshot(updated);

    expect(store.blocksInOrder[0]).toBe(original);
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
      blocks: base.blocks.map((block, index) =>
        index === 0
          ? {
              ...block,
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
          : block
      ),
    };
    const completed = {
      ...running,
      blocks: running.blocks.map((block, index) =>
        index === 0
          ? {
              ...block,
              currentExecution: {
                ...block.currentExecution!,
                status: 'completed',
              },
              output: {table: 'result'},
              outputStatus: 'available',
            }
          : block
      ),
    };
    const {store, transport} = makeStore(running, {
      loadDetail: jest.fn().mockResolvedValueOnce(running).mockResolvedValue(completed),
      loadBlockExecution: jest.fn().mockResolvedValue({
        id: 'execution-1',
        status: 'completed',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      }),
    });

    await store.load();
    expect(store.hasPendingExecution).toBe(true);
    await jest.advanceTimersByTimeAsync(1500);

    expect(transport.loadDetail).toHaveBeenCalledTimes(2);
    expect(store.blocksInOrder[0]!.outputStatus).toBe('available');
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

  it('deduplicates remote events, ignores older sequences, and keeps block identity', async () => {
    const detail = InvestigationDetailFixture();
    const {store} = makeStore(detail);
    await store.load();
    const block = store.blocksInOrder[0]!;
    const remote = {...detail.blocks[0]!, title: 'Remote title', version: 2};

    store.applyRemoteEvent({
      blockId: remote.id,
      eventId: 'event-2',
      kind: 'block.upserted',
      payload: remote,
      sequence: 2,
    });
    store.applyRemoteEvent({
      blockId: remote.id,
      eventId: 'event-2',
      kind: 'block.upserted',
      payload: {...remote, title: 'Duplicate'},
      sequence: 2,
    });
    store.applyRemoteEvent({
      blockId: remote.id,
      eventId: 'event-1',
      kind: 'block.upserted',
      payload: {...remote, title: 'Older'},
      sequence: 1,
    });

    expect(store.blocksInOrder[0]).toBe(block);
    expect(block.title).toBe('Remote title');
    expect(store.lastRemoteEventSequence).toBe(2);
  });

  it('preserves dirty drafts and enters conflict for an overlapping remote edit', async () => {
    const detail = InvestigationDetailFixture();
    const {store} = makeStore(detail);
    await store.load();
    const block = store.blocksInOrder[0]!;
    block.editContent('Unsaved local Markdown');

    store.applyRemoteEvent({
      blockId: block.serverId!,
      eventId: 'remote-edit',
      kind: 'block.upserted',
      payload: {
        ...block.toInvestigationBlock(),
        content: 'Remote Markdown',
        version: block.version + 1,
      },
      sequence: 1,
    });

    expect(block.content).toBe('Unsaved local Markdown');
    expect(store.conflict).toMatchObject({operationKind: 'remote_conflict'});
    store.dispose();
  });

  it('applies remote insertion, order, reactions, and deletion through one boundary', async () => {
    const detail = InvestigationDetailFixture();
    const {store} = makeStore(detail);
    await store.load();
    const original = store.blocksInOrder[0]!;
    const inserted = {...detail.blocks[0]!, id: 'remote-block', position: 1};

    store.applyRemoteEvent({
      blockId: inserted.id,
      eventId: 'insert',
      kind: 'block.upserted',
      payload: inserted,
      sequence: 1,
    });
    store.applyRemoteEvent({
      blockIds: [inserted.id, original.serverId!],
      eventId: 'order',
      kind: 'blocks.reordered',
      sequence: 2,
    });
    store.applyRemoteEvent({
      blockId: inserted.id,
      eventId: 'reaction',
      kind: 'block.reactions.updated',
      payload: [{reaction: 'heart', count: 2, reactedByMe: true}],
      sequence: 3,
    });

    expect(store.blocksInOrder.map(block => block.serverId)).toEqual([
      inserted.id,
      original.serverId,
    ]);
    expect(store.blocksInOrder[0]!.reactions).toHaveLength(1);

    store.applyRemoteEvent({
      blockId: inserted.id,
      eventId: 'delete',
      kind: 'block.deleted',
      sequence: 4,
    });
    expect(store.findBlockByServerId(inserted.id)).toBeUndefined();
  });

  it('uses a local mutation echo to attach a server id without replacing a temporary store', async () => {
    const detail = InvestigationDetailFixture();
    const created = deferred<(typeof detail.blocks)[number]>();
    const {store} = makeStore(detail, {
      createBlock: jest.fn().mockReturnValue(created.promise),
    });
    await store.load();

    const inserting = store.insertBlock('text', detail.blocks.length);
    await Promise.resolve();
    const temporary = store.blocksInOrder.at(-1)!;
    const creationOperation = [...store.pendingOperations.values()].find(
      operation => operation.kind === 'block.create'
    )!;
    const serverBlock = {
      ...detail.blocks[0]!,
      id: 'created-block',
      position: detail.blocks.length,
    };

    store.applyRemoteEvent({
      blockId: serverBlock.id,
      clientMutationId: creationOperation.id,
      eventId: 'create-echo',
      kind: 'block.upserted',
      payload: serverBlock,
      sequence: 1,
    });

    expect(store.findBlockByServerId(serverBlock.id)).toBe(temporary);
    created.resolve(serverBlock);
    await inserting;
    expect(store.findBlockByServerId(serverBlock.id)).toBe(temporary);
  });

  it('validates and retains failed parameter drafts in the store', async () => {
    jest.useFakeTimers();
    const parameter = {
      constraints: {min: 1},
      defaultValue: 1,
      description: '',
      id: 'parameter-1',
      key: 'threshold',
      label: 'Threshold',
      position: 0,
      required: true,
      savedValue: 1,
      source: 'template' as const,
      type: 'number' as const,
      version: 1,
    };
    const detail = InvestigationDetailFixture({parameters: [parameter]});
    const updateParameters = jest.fn().mockRejectedValue(new Error('offline'));
    const {store} = makeStore(detail, {updateParameters});
    await store.load();

    store.editParameterValue('threshold', null);
    expect(store.parameterErrors.threshold?.code).toBe('required');
    await jest.advanceTimersByTimeAsync(600);
    expect(updateParameters).not.toHaveBeenCalled();

    store.editParameterValue('threshold', 5);
    await jest.advanceTimersByTimeAsync(600);
    expect(updateParameters).toHaveBeenCalledWith(detail.version, {
      threshold: 5,
    });
    expect(store.parameterValues.threshold).toBe(5);
    expect(store.parameterSaveState).toBe('unsaved');
    store.dispose();
    jest.useRealTimers();
  });
});
