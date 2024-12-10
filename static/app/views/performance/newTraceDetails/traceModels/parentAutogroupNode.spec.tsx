import {
  makeNodeMetadata,
  makeParentAutogroup,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {ParentAutogroupNode} from './parentAutogroupNode';
import {TraceTreeNode} from './traceTreeNode';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;

describe('ParentAutogroupNode', () => {
  it('not expanded by default', () => {
    const node = new ParentAutogroupNode(
      null,
      makeParentAutogroup({autogrouped_by: {op: 'op'}}),
      makeNodeMetadata(),
      new TraceTreeNode(null, makeSpan(), makeNodeMetadata()),
      new TraceTreeNode(null, makeSpan(), makeNodeMetadata())
    );
    expect(node.expanded).toBe(false);
  });

  it('segments', () => {
    const head = new TraceTreeNode(
      null,
      makeSpan({start_timestamp: start, timestamp: start + 1}),
      makeNodeMetadata()
    );
    const tail = new TraceTreeNode(
      head,
      makeSpan({start_timestamp: start + 1, timestamp: start + 2}),
      makeNodeMetadata()
    );

    head.children.push(tail);

    const node = new ParentAutogroupNode(
      null,
      makeParentAutogroup({autogrouped_by: {op: 'op'}}),
      makeNodeMetadata(),
      head,
      tail
    );

    expect(node.autogroupedSegments).toEqual([[start * 1e3, 2000]]);
  });

  it('segments with gap', () => {
    const head = new TraceTreeNode(
      null,
      makeSpan({start_timestamp: start, timestamp: start + 1}),
      makeNodeMetadata()
    );
    const tail = new TraceTreeNode(
      head,
      makeSpan({start_timestamp: start + 2, timestamp: start + 3}),
      makeNodeMetadata()
    );

    head.children.push(tail);

    const node = new ParentAutogroupNode(
      null,
      makeParentAutogroup({autogrouped_by: {op: 'op'}}),
      makeNodeMetadata(),
      head,
      tail
    );

    expect(node.autogroupedSegments).toEqual([
      [start * 1e3, 1000],
      [start * 1e3 + 2000, 1000],
    ]);
  });
});
