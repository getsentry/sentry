import {
  makeNodeMetadata,
  makeParentAutogroup,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {ParentAutogroupNode} from './parentAutogroupNode';
import {TraceTreeNode} from './traceTreeNode';

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

  it.todo('segments');
});
