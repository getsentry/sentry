import {OrganizationFixture} from 'sentry-fixture/organization';

import {isEAPSpanNode} from './../traceGuards';
import {makeExampleTrace} from './makeExampleTrace';
import {TraceTree} from './traceTree';

describe('makeExampleTrace', () => {
  it('renders a multi level waterfall', () => {
    const tree = makeExampleTrace(OrganizationFixture());
    tree.build();

    // Root span + its descendants
    expect(tree.list).toHaveLength(22);
    expect(Math.max(...tree.list.map(node => TraceTree.Depth(node)))).toBeGreaterThan(1);
  });

  it('makes spans with unique ids so none are dropped as cycles', () => {
    const tree = makeExampleTrace(OrganizationFixture());
    tree.build();

    const spans = tree.list.filter(isEAPSpanNode);
    expect(spans).toHaveLength(21);
    expect(new Set(spans.map(span => span.id)).size).toBe(spans.length);
  });
});
