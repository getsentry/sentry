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
  computeTraceIconPlacement: (
    timestamp: number,
    width: number,
    nodeSpace: [number, number]
  ) => {
    const clampedTimestamp = Math.min(
      Math.max(timestamp, nodeSpace[0]),
      nodeSpace[0] + nodeSpace[1]
    );
    const edge = clampedTimestamp < 1009 ? 'start' : null;
    const anchorTimestamp = edge === 'start' ? nodeSpace[0] : clampedTimestamp;

    return {
      edge,
      anchorTimestamp,
      bounds: [anchorTimestamp - width / 2, anchorTimestamp + width / 2],
    };
  },
  computeRelativeLeftPositionFromOrigin: (
    timestamp: number,
    nodeSpace: [number, number]
  ) => (timestamp - nodeSpace[0]) / nodeSpace[1],
  text_measurer: {
    measure: jest.fn((text: string) => text.length * 7),
  },
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
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('summarizes child-derived issues into one icon with an additional issue count', () => {
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
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('2');
  });

  it('preserves direct issue icons and adds one child-derived issue count', () => {
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
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('1');
  });

  it('renders a single child-derived issue without an extra count', () => {
    const childError = makeEAPError({event_id: 'child-error', issue_id: 1});
    const node = {
      value: makeEAPSpan({errors: [], occurrences: []}),
      errors: new Set([childError]),
      occurrences: new Set(),
    } as unknown as BaseNode;

    renderIcons(node);

    const issueIcon = screen.getByTestId('trace-issue-icon');
    expect(issueIcon).toHaveClass('TraceIcon');
    expect(issueIcon).not.toHaveClass('TraceIconGroup');
    expect(screen.queryByTestId('trace-issue-count')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('1');
  });

  it('uses measured issue count text width for child-derived issue pill edge clamping', () => {
    const computeTraceIconPlacement = jest.fn(
      (timestamp: number, width: number, nodeSpace: [number, number]) => ({
        edge: null,
        anchorTimestamp: timestamp,
        bounds: [nodeSpace[0], nodeSpace[0] + width],
      })
    );
    const measuredManager = {
      ...manager,
      computeTraceIconPlacement,
      text_measurer: {
        measure: jest.fn(() => 32),
      },
    } as unknown as VirtualizedViewManager;
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

    render(
      <TraceIssueIcons
        node={node}
        node_space={[1000, 100]}
        errors={node.errors}
        occurrences={node.occurrences}
        manager={measuredManager}
      />
    );

    expect(measuredManager.text_measurer.measure).toHaveBeenCalledWith('1');
    expect(computeTraceIconPlacement).toHaveBeenCalledWith(1040, 56, [1000, 100]);
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
