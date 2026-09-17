import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {COLLAPSED_GAP_WIDTH_PX, TraceTimeCompression} from './traceTimeCompression';

function node(type: string, space: [number, number]) {
  return {type, space} as any;
}

describe('TraceTimeCompression', () => {
  describe.each(['sibling', 'parent'] as const)('%s autogroups', grouping => {
    function makeTree(durations = [100, 100, 100, 100, 100]) {
      const organization = OrganizationFixture();
      const spans = durations.map((duration, index) =>
        makeEAPSpan({
          start_timestamp: (index * 225) / 1000,
          end_timestamp: (index * 225 + duration) / 1000,
        })
      );
      if (grouping === 'parent') {
        for (let i = 0; i < spans.length - 1; i++) {
          spans[i]!.children = [spans[i + 1]!];
        }
      }
      return TraceTree.FromTrace(grouping === 'parent' ? [spans[0]!] : spans, {
        organization,
        replay: null,
        meta: null,
      }).build();
    }

    function groupTree(tree: TraceTree) {
      if (grouping === 'parent') {
        TraceTree.AutogroupDirectChildrenSpanNodes(tree.root);
      } else {
        TraceTree.AutogroupSiblingSpanNodes(tree.root, {
          organization: OrganizationFixture(),
        });
      }
      tree.rebuild();
      const group = tree.list.find(
        item => isParentAutogroupedNode(item) || isSiblingAutogroupedNode(item)
      );
      if (!group) {
        throw new Error('Expected an autogroup in the visible tree');
      }
      return group;
    }

    function compress(nodes: BaseNode[], indicators: TraceTree.Indicator[] = []) {
      return TraceTimeCompression.FromVisibleItems({
        enabled: true,
        traceSpace: [0, 1000],
        physicalWidth: 2000,
        nodes,
        indicators,
      });
    }

    it('preserves inactive gaps when grouping, expanding, and ungrouping spans', () => {
      const tree = makeTree();
      const before = compress(tree.list);
      expect(before.gaps.map(gap => [gap.start, gap.end])).toEqual([
        [124, 201],
        [349, 426],
        [574, 651],
        [799, 876],
      ]);

      const group = groupTree(tree);
      expect(group.space).toEqual([0, 1000]);
      expect(group.autogroupedSegments).toHaveLength(5);
      expect(compress(tree.list).gaps).toEqual(before.gaps);

      for (const expanded of [true, false]) {
        group.expand(expanded, tree);
        expect(compress(tree.list).gaps).toEqual(before.gaps);
      }

      if (grouping === 'parent') {
        TraceTree.RemoveDirectChildrenAutogroupNodes(tree.root);
      } else {
        TraceTree.RemoveSiblingAutogroupNodes(tree.root);
      }
      tree.rebuild();
      expect(compress(tree.list).gaps).toEqual(before.gaps);
    });

    it('protects activity from other rows and indicators between group segments', () => {
      const tree = makeTree();
      groupTree(tree);

      const compression = compress(
        [...tree.list, node('span', [100, 125])],
        [
          {
            start: 387,
            duration: 387,
            label: 'LCP',
            measurement: {value: 387},
            node: tree.list[0]!,
            poor: false,
            type: 'lcp',
          },
        ]
      );
      expect(compression.gaps.map(gap => [gap.start, gap.end])).toEqual([
        [574, 651],
        [799, 876],
      ]);
    });

    it('preserves buffers around zero-duration segments', () => {
      const tree = makeTree([100, 100, 0, 100, 100]);
      const before = compress(tree.list);
      expect(before.gaps.map(gap => [gap.start, gap.end])).toEqual([
        [124, 201],
        [349, 436],
        [464, 651],
        [799, 876],
      ]);
      groupTree(tree);
      expect(compress(tree.list).gaps).toEqual(before.gaps);
    });

    it('keeps overlapping segments continuous', () => {
      const tree = makeTree([1000, 775, 550, 325, 100]);
      const group = groupTree(tree);
      expect(group.autogroupedSegments).toEqual([[0, 1000]]);
      expect(compress(tree.list).enabled).toBe(false);
    });
  });

  it('collapses gaps at least 5% of the trace duration', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [
        node('trace', [0, 1000]),
        node('transaction', [0, 100]),
        node('span', [500, 100]),
      ],
      indicators: [],
    });

    expect(compression.enabled).toBe(true);
    expect(compression.gaps).toHaveLength(2);
    expect(compression.gaps[0]).toMatchObject({start: 148, end: 452});
    expect(compression.gaps[1]).toMatchObject({start: 648, end: 1000});
  });

  it('keeps a pixel-derived duration label buffer around visible spans', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 10_000],
      physicalWidth: 1000,
      nodes: [node('span', [2000, 1000]), node('span', [7000, 1000])],
      indicators: [],
    });

    // 48px in a 10s trace rendered into 1000px is 480ms of real timeline buffer.
    expect(compression.gaps).toHaveLength(3);
    expect(compression.gaps[0]).toMatchObject({start: 0, end: 1520});
    expect(compression.gaps[1]).toMatchObject({start: 3480, end: 6520});
    expect(compression.gaps[2]).toMatchObject({start: 8480, end: 10_000});
  });

  it('does not collapse gaps covered by visible intervals', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [
        node('transaction', [0, 1000]),
        node('span', [0, 100]),
        node('span', [500, 100]),
      ],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.gaps).toHaveLength(0);
  });

  it('keeps a pixel-derived buffer around zero-duration errors', () => {
    const physicalWidth = 600;
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 3_600_000],
      physicalWidth,
      nodes: [
        node('span', [0, 600_000]),
        node('error', [2_100_000, 0]),
        node('span', [3_000_000, 600_000]),
      ],
      indicators: [],
    });

    expect(compression.gaps).toHaveLength(2);
    const [beforeError, afterError] = compression.gaps;
    const errorBufferPx =
      ((afterError!.compressedStart - beforeError!.compressedEnd) /
        compression.compressedDuration) *
      physicalWidth;

    expect(errorBufferPx).toBeGreaterThanOrEqual(COLLAPSED_GAP_WIDTH_PX * 2);
  });

  it('round trips between real and compressed coordinates', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: true,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [node('transaction', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });

    for (const timestamp of [0, 100, 250, 500, 600, 800, 1000]) {
      expect(
        compression.toRealTimestamp(compression.toCompressedOffset(timestamp))
      ).toBeCloseTo(timestamp);
    }
  });

  it('does not collapse when the preference is disabled', () => {
    const compression = TraceTimeCompression.FromVisibleItems({
      enabled: false,
      traceSpace: [0, 1000],
      physicalWidth: 1000,
      nodes: [node('transaction', [0, 100]), node('span', [500, 100])],
      indicators: [],
    });

    expect(compression.enabled).toBe(false);
    expect(compression.toCompressedOffset(500)).toBe(500);
  });
});
