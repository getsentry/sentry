import {
  makeNodeMetadata,
  makeSiblingAutogroup,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {SiblingAutogroupNode} from './siblingAutogroupNode';

describe('SiblingAutogroupNode', () => {
  it('not expanded by default', () => {
    const node = new SiblingAutogroupNode(
      null,
      makeSiblingAutogroup({autogrouped_by: {op: 'op', description: 'description'}}),
      makeNodeMetadata()
    );
    expect(node.expanded).toBe(false);
  });
});
