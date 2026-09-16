import {useLayoutEffect, type PropsWithChildren} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPError,
  makeEAPOccurrence,
  makeEAPSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

import {AutogroupedTraceBar} from './traceBar';

function CompressionLayoutEffect({
  children,
  manager,
  physicalWidth,
}: PropsWithChildren<{manager: VirtualizedViewManager; physicalWidth: number}>) {
  // Trace updates compression and redraws bars after its children render.
  useLayoutEffect(() => {
    manager.recomputeTimeCompression();
    manager.draw();
  }, [manager, physicalWidth]);
  return children;
}

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
        meta: null,
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
