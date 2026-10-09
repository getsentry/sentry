import {
  formatMemoryScore,
  getMemoryPreview,
  getMemoryResultText,
  getNodeMemory,
  isMemoryNode,
  isMemoryOperation,
  type Memory,
} from 'sentry/views/insights/pages/agents/utils/memory';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

function makeNode(attributes: Record<string, string | number>): AITraceSpanNode {
  return {errors: new Set(), attributes} as unknown as AITraceSpanNode;
}

function makeMemory(overrides: Partial<Memory>): Memory {
  return {
    operation: undefined,
    query: undefined,
    rawRecords: undefined,
    recordCount: undefined,
    recordId: undefined,
    records: null,
    storeId: undefined,
    ...overrides,
  };
}

describe('isMemoryOperation', () => {
  it('recognizes the well-known memory operation names', () => {
    expect(isMemoryOperation('search_memory')).toBe(true);
    expect(isMemoryOperation('create_memory_store')).toBe(true);
    expect(isMemoryOperation('upsert_memory')).toBe(true);
  });

  it('rejects other operation names', () => {
    expect(isMemoryOperation('chat')).toBe(false);
    expect(isMemoryOperation('embeddings')).toBe(false);
    expect(isMemoryOperation(undefined)).toBe(false);
  });
});

describe('isMemoryNode', () => {
  it('matches on gen_ai.operation.name', () => {
    expect(isMemoryNode(makeNode({'gen_ai.operation.name': 'search_memory'}))).toBe(true);
    expect(isMemoryNode(makeNode({'gen_ai.operation.name': 'chat'}))).toBe(false);
    expect(isMemoryNode(makeNode({}))).toBe(false);
  });
});

describe('getNodeMemory', () => {
  it('reads the memory attributes off a memory span', () => {
    const node = makeNode({
      'gen_ai.operation.name': 'search_memory',
      'gen_ai.memory.store.id': 'user-prefs',
      'gen_ai.memory.query.text': 'dietary preferences',
      'gen_ai.memory.record.count': '2',
      'gen_ai.memory.records': JSON.stringify([
        {content: 'a', score: 0.9},
        {content: 'b', score: 0.5},
      ]),
    });

    expect(getNodeMemory(node)).toEqual({
      operation: 'search_memory',
      query: 'dietary preferences',
      storeId: 'user-prefs',
      recordId: undefined,
      recordCount: 2,
      rawRecords: expect.any(String),
      records: [
        {content: 'a', score: 0.9},
        {content: 'b', score: 0.5},
      ],
    });
  });

  it('returns null for non-memory spans', () => {
    expect(getNodeMemory(makeNode({'gen_ai.operation.name': 'chat'}))).toBeNull();
  });

  it('degrades to a count-only read when records are not captured', () => {
    const memory = getNodeMemory(
      makeNode({
        'gen_ai.operation.name': 'create_memory',
        'gen_ai.memory.record.count': '3',
      })
    );

    expect(memory?.records).toBeNull();
    expect(memory?.recordCount).toBe(3);
  });

  it('keeps a non-record element whole as content', () => {
    const memory = getNodeMemory(
      makeNode({
        'gen_ai.operation.name': 'search_memory',
        'gen_ai.memory.records': JSON.stringify(['just a string']),
      })
    );

    expect(memory?.records).toEqual([{content: 'just a string'}]);
  });

  it('leaves records null when they are not parseable JSON', () => {
    const memory = getNodeMemory(
      makeNode({
        'gen_ai.operation.name': 'search_memory',
        'gen_ai.memory.records': '[not json',
      })
    );

    expect(memory?.records).toBeNull();
  });
});

describe('getMemoryPreview', () => {
  it('shows only the query for a search', () => {
    expect(
      getMemoryPreview(
        makeMemory({
          operation: 'search_memory',
          query: 'dietary preferences',
          recordCount: 3,
        })
      )
    ).toBe('“dietary preferences”');
    expect(getMemoryPreview(makeMemory({operation: 'search_memory'}))).toBe('');
  });

  it('shows a single record’s content when captured', () => {
    expect(
      getMemoryPreview(
        makeMemory({
          operation: 'create_memory',
          recordCount: 1,
          records: [{content: 'User prefers dark mode'}],
        })
      )
    ).toBe('User prefers dark mode');
  });

  it('falls back to the record count as memories', () => {
    expect(
      getMemoryPreview(makeMemory({operation: 'create_memory', recordCount: 3}))
    ).toBe('3 memories');
    expect(
      getMemoryPreview(makeMemory({operation: 'update_memory', recordCount: 1}))
    ).toBe('1 memory');
  });

  it('summarizes a delete by count, record id, or store-wide fallback', () => {
    expect(
      getMemoryPreview(makeMemory({operation: 'delete_memory', recordCount: 2}))
    ).toBe('2 memories');
    // A single deleted record shows the count, not its content.
    expect(
      getMemoryPreview(
        makeMemory({
          operation: 'delete_memory',
          recordCount: 1,
          records: [{content: 'User prefers dark mode'}],
        })
      )
    ).toBe('1 memory');
    expect(
      getMemoryPreview(makeMemory({operation: 'delete_memory', recordId: 'mem_1'}))
    ).toBe('mem_1');
    expect(getMemoryPreview(makeMemory({operation: 'delete_memory'}))).toBe(
      'all memories'
    );
  });

  it('summarizes a store operation by its store id', () => {
    expect(
      getMemoryPreview(makeMemory({operation: 'create_memory_store', storeId: 'ms_1'}))
    ).toBe('ms_1');
  });

  it('is empty for no memory', () => {
    expect(getMemoryPreview(null)).toBe('');
  });
});

describe('getMemoryResultText', () => {
  it('describes write results', () => {
    const base = {
      query: undefined,
      records: null,
      recordId: undefined,
      storeId: undefined,
      rawRecords: undefined,
    };
    expect(
      getMemoryResultText({...base, operation: 'create_memory', recordCount: 2})
    ).toBe('2 records created');
    expect(
      getMemoryResultText({...base, operation: 'upsert_memory', recordCount: 2})
    ).toBe('2 records written');
    expect(
      getMemoryResultText({...base, operation: 'delete_memory', recordCount: 1})
    ).toBe('1 record deleted');
    expect(
      getMemoryResultText({...base, operation: 'search_memory', recordCount: 5})
    ).toBeUndefined();
  });
});

describe('formatMemoryScore', () => {
  it('rounds to two decimals', () => {
    expect(formatMemoryScore(0.953)).toBe('0.95');
    expect(formatMemoryScore(1)).toBe('1');
  });
});
