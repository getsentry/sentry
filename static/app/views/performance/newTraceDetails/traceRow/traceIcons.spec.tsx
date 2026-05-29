import {render, screen} from 'sentry-test/reactTestingLibrary';

import {makeEAPOccurrence} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceBackgroundPatterns} from 'sentry/views/performance/newTraceDetails/traceRow/traceBackgroundPatterns';
import {
  limitTraceIssueMarkers,
  MAX_TRACE_ISSUE_MARKERS_PER_ROW,
  TraceOccurenceIcons,
} from 'sentry/views/performance/newTraceDetails/traceRow/traceIcons';

const manager = {
  computeRelativeLeftPositionFromOrigin: (
    timestamp: number,
    entireSpace: [number, number]
  ) => {
    return (timestamp - entireSpace[0]) / entireSpace[1];
  },
} as VirtualizedViewManager;

function makeOccurrences(count: number) {
  return new Set(
    Array.from({length: count}, (_value, index) =>
      makeEAPOccurrence({event_id: `occurrence-${index}`, start_timestamp: index})
    )
  );
}

describe('trace issue markers', () => {
  it('returns all markers when they fit under the limit', () => {
    const markers = [1, 2, 3];

    expect(limitTraceIssueMarkers(markers)).toBe(markers);
  });

  it('samples large marker lists while preserving the first and last markers', () => {
    const markers = Array.from({length: 600}, (_value, index) => index);
    const limited = limitTraceIssueMarkers(markers);

    expect(limited).toHaveLength(MAX_TRACE_ISSUE_MARKERS_PER_ROW);
    expect(limited[0]).toBe(0);
    expect(limited.at(-1)).toBe(599);
  });

  it('limits rendered occurrence icons', () => {
    render(
      <TraceOccurenceIcons
        node_space={[0, 600_000]}
        occurrences={makeOccurrences(600)}
        manager={manager}
      />
    );

    expect(screen.getAllByTestId('trace-issue-icon')).toHaveLength(
      MAX_TRACE_ISSUE_MARKERS_PER_ROW
    );
  });

  it('limits rendered occurrence background markers', () => {
    render(
      <TraceBackgroundPatterns
        node_space={[0, 600_000]}
        occurrences={makeOccurrences(600)}
        errors={new Set()}
        manager={manager}
      />
    );

    expect(screen.getAllByTestId('trace-issue-pattern')).toHaveLength(
      MAX_TRACE_ISSUE_MARKERS_PER_ROW
    );
  });
});
