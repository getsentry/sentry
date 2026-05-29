import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';
import {TraceIssueIcons} from 'sentry/views/performance/newTraceDetails/traceRow/traceIcons';

const manager = {
  computeTraceIconAnchorTimestamp: (timestamp: number, edge: 'start' | 'end' | null) => {
    if (edge === 'start') {
      return 1000;
    }
    if (edge === 'end') {
      return 1100;
    }
    return timestamp;
  },
  computeTraceIconEdge: (timestamp: number) => {
    if (timestamp < 1009) {
      return 'start';
    }
    return null;
  },
  computeRelativeLeftPositionFromOrigin: (
    timestamp: number,
    nodeSpace: [number, number]
  ) => (timestamp - nodeSpace[0]) / nodeSpace[1],
} as unknown as VirtualizedViewManager;

function renderIcons(node: BaseNode, nodeSpace: [number, number] = [0, 10_000]) {
  return render(
    <TraceIssueIcons
      node={node}
      node_space={nodeSpace}
      errors={node.errors}
      occurrences={node.occurrences}
      manager={manager}
    />
  );
}

describe('TraceIssueIcons', () => {
  it('summarizes child-derived issues into one icon', () => {
    const childErrorA = makeEAPError({event_id: 'child-error-a', issue_id: 1});
    const childErrorB = makeEAPError({event_id: 'child-error-b', issue_id: 2});
    const childOccurrence = makeEAPOccurrence({
      event_id: 'child-occurrence',
      issue_id: 3,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childErrorA, childErrorB]),
      occurrences: new Set([childOccurrence]),
    } as unknown as BaseNode;

    renderIcons(node);

    expect(screen.getAllByTestId('trace-issue-icon')).toHaveLength(1);
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('3');
  });

  it('preserves direct issue icons and adds one child-derived issue icon', () => {
    const directErrorA = makeEAPError({event_id: 'direct-error-a', issue_id: 1});
    const directErrorB = makeEAPError({event_id: 'direct-error-b', issue_id: 2});
    const childErrorA = makeEAPError({event_id: 'child-error-a', issue_id: 3});
    const childErrorB = makeEAPError({event_id: 'child-error-b', issue_id: 4});
    const node = {
      value: makeEAPSpan({errors: [directErrorA, directErrorB], occurrences: []}),
      errors: new Set([directErrorA, directErrorB, childErrorA, childErrorB]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node);

    expect(screen.getAllByTestId('trace-issue-icon')).toHaveLength(3);
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('2');
  });

  it('anchors a start-edge direct issue icon to the span start', () => {
    const directError = makeEAPError({
      event_id: 'direct-error',
      issue_id: 1,
      start_timestamp: 1.0005,
    });
    const node = {
      value: makeEAPSpan({errors: [directError], occurrences: []}),
      errors: new Set([directError]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node, [1000, 1]);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).toHaveClass('TraceIcon');
    expect(issueIcon).toHaveClass('TraceIconStart');
    expect(issueIcon).toHaveStyle({left: '0%'});
  });

  it('keeps a direct issue icon centered when it does not overlap the span edge', () => {
    const directError = makeEAPError({
      event_id: 'direct-error',
      issue_id: 1,
      start_timestamp: 1.01,
    });
    const node = {
      value: makeEAPSpan({errors: [directError], occurrences: []}),
      errors: new Set([directError]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node, [1000, 100]);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).not.toHaveClass('TraceIconStart');
    expect(issueIcon).not.toHaveClass('TraceIconEnd');
    expect(issueIcon).toHaveStyle({left: '10%'});
  });

  it('anchors the child-derived issue pill to the span start for a narrow span duration', () => {
    const childErrorA = makeEAPError({
      event_id: 'child-error-a',
      issue_id: 1,
      start_timestamp: 1.0005,
    });
    const childErrorB = makeEAPError({
      event_id: 'child-error-b',
      issue_id: 2,
      start_timestamp: 1.0005,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childErrorA, childErrorB]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node, [1000, 1]);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).toHaveClass('TraceIconGroup');
    expect(issueIcon).toHaveClass('TraceIconGroupStart');
    expect(issueIcon).toHaveStyle({left: '0%'});
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('2');
  });

  it('anchors a start-clamped child-derived issue pill to the span start', () => {
    const childErrorA = makeEAPError({
      event_id: 'child-error-a',
      issue_id: 1,
      start_timestamp: 0.9,
    });
    const childErrorB = makeEAPError({
      event_id: 'child-error-b',
      issue_id: 2,
      start_timestamp: 0.9,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childErrorA, childErrorB]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node, [1000, 1]);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).toHaveClass('TraceIconGroupStart');
    expect(issueIcon).toHaveStyle({left: '0%'});
  });

  it('keeps a child-derived issue pill centered when it does not overlap the span edge', () => {
    const childErrorA = makeEAPError({
      event_id: 'child-error-a',
      issue_id: 1,
      start_timestamp: 1.04,
    });
    const childErrorB = makeEAPError({
      event_id: 'child-error-b',
      issue_id: 2,
      start_timestamp: 1.04,
    });
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childErrorA, childErrorB]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node, [1000, 100]);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).not.toHaveClass('TraceIconGroupStart');
    expect(issueIcon).not.toHaveClass('TraceIconGroupEnd');
    expect(issueIcon).toHaveStyle({left: '40%'});
  });
});
