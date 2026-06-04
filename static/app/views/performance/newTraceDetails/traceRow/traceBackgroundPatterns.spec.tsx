import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceBackgroundPatterns} from 'sentry/views/performance/newTraceDetails/traceRow/traceBackgroundPatterns';

const manager = {
  computeRelativeLeftPositionFromOrigin: () => 0.5,
} as unknown as VirtualizedViewManager;

function renderPatterns(node: BaseNode) {
  return render(
    <TraceBackgroundPatterns
      node={node}
      node_space={[0, 10_000]}
      errors={node.errors}
      occurrences={node.occurrences}
      manager={manager}
    />
  );
}

describe('TraceBackgroundPatterns', () => {
  it('does not render a colored pattern for child-derived issues', () => {
    const childError = makeEAPError({event_id: 'child-error', issue_id: 1});
    const childOccurrence = makeEAPOccurrence({
      event_id: 'child-occurrence',
      issue_id: 2,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childError]),
      occurrences: new Set([childOccurrence]),
    } as unknown as BaseNode;

    renderPatterns(node);

    expect(screen.queryByTestId('trace-issue-pattern')).not.toBeInTheDocument();
  });

  it('still renders a colored pattern for direct issues', () => {
    const directOccurrence = makeEAPOccurrence({
      event_id: 'direct-occurrence',
      issue_id: 1,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: [directOccurrence]}),
      errors: new Set(),
      occurrences: new Set([directOccurrence]),
    } as unknown as BaseNode;

    renderPatterns(node);

    expect(screen.getByTestId('trace-issue-pattern')).toBeInTheDocument();
  });
});
