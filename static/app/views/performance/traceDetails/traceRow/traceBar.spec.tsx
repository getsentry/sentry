import {useLayoutEffect, type PropsWithChildren} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from 'sentry/views/performance/traceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {SiblingAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/siblingAutogroupNode';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
  makeSiblingAutogroup,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {TraceScheduler} from 'sentry/views/performance/traceDetails/traceRenderers/traceScheduler';
import {TraceTimeCompression} from 'sentry/views/performance/traceDetails/traceRenderers/traceTimeCompression';
import {TraceView} from 'sentry/views/performance/traceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/traceDetails/traceRenderers/virtualizedViewManager';
import {
  AutogroupedTraceBar,
  InvisibleTraceBar,
} from 'sentry/views/performance/traceDetails/traceRow/traceBar';

function CompressionLayoutEffect({
  children,
  manager,
  physicalWidth,
}: PropsWithChildren<{manager: VirtualizedViewManager; physicalWidth: number}>) {
  // Trace updates compression and redraws bars after its children render.
  useLayoutEffect(() => {
    manager.recomputeTimeCompression();
    manager.draw();
    // Width changes trigger the post-render redraw, mirroring Trace.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [manager, physicalWidth]);
  return children;
}

function createManager({
  compressed,
  traceStart = 1000,
  spanSpaces = [
    [1000, 100],
    [1900, 100],
  ],
}: {
  compressed: boolean;
  spanSpaces?: Array<[number, number]>;
  traceStart?: number;
}) {
  const manager = new VirtualizedViewManager(
    {list: {width: 0}, span_list: {width: 1}},
    new TraceScheduler(),
    new TraceView(),
    ThemeFixture()
  );
  manager.view.setTraceSpace([traceStart, 0, 1000, 1]);
  manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
  if (compressed) {
    manager.setTimeCompression(
      TraceTimeCompression.FromVisibleItems({
        enabled: true,
        traceSpace: [traceStart, 1000],
        physicalWidth: 1000,
        nodes: spanSpaces.map(
          ([start, duration]) =>
            new EapSpanNode(
              null,
              makeEAPSpan({
                start_timestamp: start / 1000,
                end_timestamp: (start + duration) / 1000,
              }),
              {organization: OrganizationFixture()}
            )
        ),
        indicators: [],
      })
    );
    expect(manager.time_compression.enabled).toBe(true);
  }
  manager.recomputeSpanToPXMatrix();
  return manager;
}

function redrawInvisibleBars(manager: VirtualizedViewManager) {
  manager.recomputeSpanToPXMatrix();
  manager.drawInvisibleBars();
}

describe.each([false, true])('InvisibleTraceBar with compression=%s', compressed => {
  it.each([
    {timestamp: 1000, edge: 'Start'},
    {timestamp: 1001, edge: 'Start'},
    {timestamp: 1500, edge: null},
    {timestamp: 1999, edge: 'End'},
    {timestamp: 2000, edge: 'End'},
  ])('keeps the error icon at $timestamp inside the viewport', ({timestamp, edge}) => {
    const manager = createManager({compressed});

    render(
      <InvisibleTraceBar
        manager={manager}
        node_space={[timestamp, 0]}
        virtualizedIndex={0}
      >
        <div className="TraceIcon error" data-test-id="error-icon" />
      </InvisibleTraceBar>
    );

    const icon = screen.getByTestId('error-icon');
    const bar = icon.parentElement!;
    if (timestamp === 1000 || timestamp === 2000) {
      expect(Number(bar.style.transform.split(',')[4])).toBeCloseTo(
        timestamp === 1000 ? 0 : 1000
      );
    }
    expect(icon).toHaveClass(`TraceIcon error${edge ? ` TraceIcon${edge}` : ''}`, {
      exact: true,
    });

    // Changing the viewport must update alignment without a React rerender.
    manager.view.setTraceView({x: 0, width: 500});
    redrawInvisibleBars(manager);
    if (timestamp === 1500) {
      expect(icon).toHaveClass('TraceIconEnd');
      manager.view.setTraceView({x: 500, width: 500});
      redrawInvisibleBars(manager);
      expect(icon).toHaveClass('TraceIconStart');
      expect(icon).not.toHaveClass('TraceIconEnd');
    }

    manager.view.setTraceView({x: 0, width: 1000});
    manager.view.setTracePhysicalSpace([0, 0, 500, 1], [0, 0, 500, 1]);
    redrawInvisibleBars(manager);
    expect(icon).toHaveClass(`TraceIcon error${edge ? ` TraceIcon${edge}` : ''}`, {
      exact: true,
    });
    if (timestamp === 1000 || timestamp === 2000) {
      expect(Number(bar.style.transform.split(',')[4])).toBeCloseTo(
        timestamp === 1000 ? 0 : 500
      );
    }
  });
});

describe.each([false, true])('AutogroupedTraceBar with compression=%s', compressed => {
  it('preserves the end-of-trace clearance on registration and redraw', () => {
    const manager = createManager({
      compressed,
      traceStart: 0,
      spanSpaces: [
        [0, 100],
        [950, 50],
      ],
    });
    const node = new SiblingAutogroupNode(null, makeSiblingAutogroup(), {
      organization: OrganizationFixture(),
    });
    node.space = [950, 50];
    manager.columns.list.column_nodes[0] = node;

    render(
      <AutogroupedTraceBar
        color="red"
        entire_space={node.space}
        errors={node.errors}
        manager={manager}
        node={node}
        node_spaces={[
          [950, 20],
          [980, 20],
        ]}
        occurrences={node.occurrences}
        virtualized_index={0}
      />
    );
    const bar = manager.invisible_bars[0]!.ref;
    expect(Number(bar.style.transform.split(',')[4])).toBeCloseTo(
      manager.transformXFromTimestamp(950) - 2
    );
    if (!compressed) {
      expect(Number(bar.style.transform.split(',')[4])).toBe(948);
    }

    manager.view.setTraceView({x: 500, width: 500});
    redrawInvisibleBars(manager);
    expect(Number(bar.style.transform.split(',')[4])).toBeCloseTo(
      manager.transformXFromTimestamp(950) - 2
    );

    manager.view.setTraceView({x: 0, width: 1000});
    manager.view.setTracePhysicalSpace([0, 0, 500, 1], [0, 0, 500, 1]);
    redrawInvisibleBars(manager);
    expect(Number(bar.style.transform.split(',')[4])).toBeCloseTo(
      manager.transformXFromTimestamp(950) - 2
    );
    if (!compressed) {
      expect(Number(bar.style.transform.split(',')[4])).toBe(473);
    }
  });

  it.each([1, 2])(
    'keeps %s child errors centered in a group starting at the left edge',
    errorCount => {
      const node = new SiblingAutogroupNode(null, makeSiblingAutogroup(), {
        organization: OrganizationFixture(),
      });
      node.space = [1000, 1000];
      node.errors = new Set(
        Array.from({length: errorCount}, (_, i) =>
          makeEAPError({
            event_id: `child-error-${i}`,
            issue_id: i + 1,
            start_timestamp: 1.5,
          })
        )
      );
      const spanSpaces: Array<[number, number]> = [
        [1000, 400],
        [1600, 400],
      ];
      const manager = createManager({compressed, spanSpaces});
      manager.columns.list.column_nodes[0] = node;

      render(
        <AutogroupedTraceBar
          color="red"
          entire_space={node.space}
          errors={node.errors}
          manager={manager}
          node={node}
          node_spaces={spanSpaces}
          occurrences={node.occurrences}
          virtualized_index={0}
        />
      );

      const icon = screen.getByTestId('trace-issue-icon');
      const iconClass = errorCount === 1 ? 'TraceIcon' : 'TraceIconGroup';
      expect(icon).toHaveClass(`${iconClass} error`, {exact: true});
      expect(icon).toHaveStyle({left: '50%'});
      if (errorCount === 2) {
        expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('1');
      }

      manager.drawInvisibleBars();
      expect(icon).toHaveClass(`${iconClass} error`, {exact: true});
      expect(icon).toHaveStyle({left: '50%'});

      // The group's start still overlaps the viewport edge after zoom and resize,
      // but the issue remains well inside it and must keep its centered alignment.
      manager.view.setTraceView({x: 0, width: 750});
      manager.view.setTracePhysicalSpace([0, 0, 500, 1], [0, 0, 500, 1]);
      redrawInvisibleBars(manager);
      expect(icon).toHaveClass(`${iconClass} error`, {exact: true});
      expect(icon).toHaveStyle({left: '50%'});
    }
  );
});

describe.each(['sibling', 'parent'] as const)('AutogroupedTraceBar (%s)', grouping => {
  it.each(['none', 'error', 'occurrence', 'combined'] as const)(
    'redraws segments and %s issues when compression changes after render',
    issueKind => {
      const organization = OrganizationFixture();
      const spans = [0, 225, 450, 675, 900].map(start =>
        makeEAPSpan({
          start_timestamp: start / 1000,
          end_timestamp: (start + 100) / 1000,
        })
      );
      if (issueKind === 'error' || issueKind === 'combined') {
        spans[4]!.errors = [makeEAPError({start_timestamp: 0.9})];
      }
      if (issueKind === 'occurrence' || issueKind === 'combined') {
        spans[4]!.occurrences = [makeEAPOccurrence({start_timestamp: 0.9})];
      }
      if (grouping === 'parent') {
        for (let i = 0; i < spans.length - 1; i++) {
          spans[i]!.children = [spans[i + 1]!];
        }
      }
      const tree = TraceTree.FromTrace(grouping === 'parent' ? [spans[0]!] : spans, {
        organization,
        replay: null,
      }).build();
      if (grouping === 'parent') {
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      } else {
        TraceTree.AutogroupSiblingSpanNodes(tree.root, {organization});
      }
      tree.rebuild();
      const group = tree.list.find(
        node => isSiblingAutogroupedNode(node) || isParentAutogroupedNode(node)
      )!;
      const manager = new VirtualizedViewManager(
        {list: {width: 0.5}, span_list: {width: 0.5}},
        new TraceScheduler(),
        new TraceView(),
        ThemeFixture()
      );
      manager.view.setTraceSpace([0, 0, 1000, 1]);
      manager.columns.list.column_nodes[0] = group;
      manager.timeCompressionOptions = {
        enabled: true,
        traceSpace: [0, 1000],
        nodes: tree.list,
        indicators: [],
      };

      const {container, rerender} = render(<div />);
      for (const physicalWidth of [2000, 1000, 2000]) {
        manager.view.setTracePhysicalSpace(
          [0, 0, physicalWidth * 2, 1],
          [0, 0, physicalWidth, 1]
        );
        rerender(
          <CompressionLayoutEffect manager={manager} physicalWidth={physicalWidth}>
            <AutogroupedTraceBar
              color="blue"
              entire_space={group.space}
              errors={group.errors}
              manager={manager}
              node={group}
              node_spaces={group.autogroupedSegments}
              occurrences={group.occurrences}
              virtualized_index={0}
            />
          </CompressionLayoutEffect>
        );

        // Timeline bars have no accessible role; inspect the rendered segment geometry.
        // oxlint-disable-next-line testing-library/no-container
        const bars = container.querySelectorAll<HTMLElement>('.Invisible > .TraceBar');
        expect(bars).toHaveLength(5);
        // At 2000px, four 77ms gaps become 28px each. At 1000px, label buffers
        // leave gaps below the compression threshold, so the timeline is linear.
        const compressedDuration = physicalWidth === 2000 ? 692 / (1 - 112 / 2000) : 1000;
        expect(manager.time_compression.enabled).toBe(physicalWidth === 2000);
        const barWidth = 100 / compressedDuration;
        bars.forEach((bar, index) => {
          expect(parseFloat(bar.style.width) / 100).toBeCloseTo(barWidth);
          expect(parseFloat(bar.style.left) / 100).toBeCloseTo(
            (index * (1 - barWidth)) / 4
          );
        });

        if (issueKind !== 'none') {
          expect(screen.getAllByTestId('trace-issue-icon')).toHaveLength(1);
          const icon = screen.getByTestId('trace-issue-icon');
          expect(parseFloat(icon.style.left)).toBeCloseTo((1 - barWidth) * 100, 6);
          if (issueKind === 'combined') {
            expect(icon).toHaveClass('TraceIconGroup');
            expect(screen.getByTestId('trace-issue-count')).toHaveTextContent('1');
            expect(screen.getByTestId('trace-issue-count')).toHaveStyle({left: ''});
          } else {
            expect(icon).toHaveClass('TraceIcon');
            expect(screen.queryByTestId('trace-issue-count')).not.toBeInTheDocument();
          }
        }
      }

      if (issueKind === 'none') {
        expect(screen.queryByTestId('trace-issue-icon')).not.toBeInTheDocument();
        return;
      }

      const icon = screen.getByTestId('trace-issue-icon');
      const baseClass = issueKind === 'combined' ? 'TraceIconGroup' : 'TraceIcon';
      const compressedDuration = 692 / (1 - 112 / 2000);
      const compressedLeft = (1 - 100 / compressedDuration) * 100;

      // These updates happen entirely in the manager, without React rerendering.
      for (const enabled of [false, true]) {
        act(() => {
          manager.timeCompressionOptions!.enabled = enabled;
          manager.recomputeTimeCompression();
          manager.draw();
        });
        expect(parseFloat(icon.style.left)).toBeCloseTo(enabled ? compressedLeft : 90, 6);
      }

      for (const [x, width, edge] of [
        [900, 100, 'Start'],
        [0, 900, 'End'],
        [0, 1000, null],
      ] as const) {
        act(() => {
          manager.view.setTraceView({x, width});
          manager.draw();
        });
        if (edge === 'Start') {
          expect(icon).toHaveClass(`${baseClass}Start`);
        } else {
          expect(icon).not.toHaveClass(`${baseClass}Start`);
        }
        if (edge === 'End') {
          expect(icon).toHaveClass(`${baseClass}End`);
        } else {
          expect(icon).not.toHaveClass(`${baseClass}End`);
        }
        expect(parseFloat(icon.style.left)).toBeCloseTo(compressedLeft, 6);
      }

      // A count badge reaches the viewport edge before a narrower single icon does.
      act(() => {
        manager.view.setTraceView({x: 0, width: 905});
        manager.draw();
      });
      if (issueKind === 'combined') {
        expect(icon).toHaveClass(`${baseClass}End`);
      } else {
        expect(icon).not.toHaveClass(`${baseClass}End`);
      }
      expect(parseFloat(icon.style.left)).toBeCloseTo(
        issueKind === 'combined' ? (1 - 95 / compressedDuration) * 100 : compressedLeft,
        6
      );
      expect(icon).toHaveClass(issueKind === 'occurrence' ? 'occurrence' : 'error');
    }
  );
});
