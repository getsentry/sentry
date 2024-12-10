import {
  makeNodeMetadata,
  makeSiblingAutogroup,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {SiblingAutogroupNode} from './siblingAutogroupNode';
import {TraceTreeNode} from './traceTreeNode';

const start = new Date('2024-02-29T00:00:00Z').getTime() / 1e3;

describe('SiblingAutogroupNode', () => {
  it('not expanded by default', () => {
    const node = new SiblingAutogroupNode(
      null,
      makeSiblingAutogroup({autogrouped_by: {op: 'op', description: 'description'}}),
      makeNodeMetadata()
    );
    expect(node.expanded).toBe(false);
  });

  it('segments', () => {
    const node = new SiblingAutogroupNode(
      null,
      makeSiblingAutogroup({autogrouped_by: {op: 'op', description: 'description'}}),
      makeNodeMetadata()
    );

    for (let i = 0; i < 5; i++) {
      node.children.push(
        new TraceTreeNode(
          node,
          makeSpan({
            description: 'span',
            op: 'db',
            start_timestamp: start + i,
            timestamp: start + i + 1,
            span_id: `span-${i}`,
            parent_span_id: node.value.span_id,
          }),
          makeNodeMetadata()
        )
      );
    }
    expect(node.autogroupedSegments).toEqual([[start * 1e3, 5000]]);
  });

  it('segments with gap', () => {
    const node = new SiblingAutogroupNode(
      null,
      makeSiblingAutogroup({autogrouped_by: {op: 'op', description: 'description'}}),
      makeNodeMetadata()
    );

    node.children.push(
      new TraceTreeNode(
        node,
        makeSpan({
          start_timestamp: start,
          timestamp: start + 1,
        }),
        makeNodeMetadata()
      )
    );

    node.children.push(
      new TraceTreeNode(
        node,
        makeSpan({
          start_timestamp: start + 2,
          timestamp: start + 3,
        }),
        makeNodeMetadata()
      )
    );
    expect(node.autogroupedSegments).toEqual([
      [start * 1e3, 1000],
      [start * 1e3 + 2000, 1000],
    ]);
  });
});
