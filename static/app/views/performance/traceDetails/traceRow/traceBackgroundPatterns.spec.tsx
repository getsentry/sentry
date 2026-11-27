import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import type {VirtualizedViewManager} from 'sentry/views/performance/traceDetails/traceRenderers/virtualizedViewManager';

import {TraceBackgroundPatterns} from './traceBackgroundPatterns';

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

  it('places the pattern of a node shifted for clock drift at the shifted timestamp', () => {
    const occurrence = makeEAPOccurrence({
      event_id: 'shifted-occurrence',
      issue_id: 1,
      start_timestamp: 1,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: [occurrence]}),
      errors: new Set(),
      occurrences: new Set([occurrence]),
      clockDriftOffsetMs: 2_000,
    } as unknown as BaseNode;
    const computeRelativeLeftPositionFromOrigin = jest.fn(() => 0.5);

    render(
      <TraceBackgroundPatterns
        node={node}
        node_space={[2_500, 5_000]}
        errors={node.errors}
        occurrences={node.occurrences}
        manager={
          {computeRelativeLeftPositionFromOrigin} as unknown as VirtualizedViewManager
        }
      />
    );

    // Recorded at 1000ms, shown 2000ms later along with its span
    expect(computeRelativeLeftPositionFromOrigin).toHaveBeenCalledWith(
      3_000,
      [2_500, 5_000]
    );
  });
});
