import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render} from 'sentry-test/reactTestingLibrary';

import {isSiblingAutogroupedNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {TraceScheduler} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceScheduler';
import {TraceView} from 'sentry/views/performance/newTraceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

import {AutogroupedTraceBar} from './traceBar';

describe('AutogroupedTraceBar', () => {
  it('positions segments in compressed time and updates them when resizing', () => {
    const organization = OrganizationFixture();
    const tree = TraceTree.FromTrace(
      [0, 225, 450, 675, 900].map(start =>
        makeEAPSpan({
          start_timestamp: start / 1000,
          end_timestamp: (start + 100) / 1000,
        })
      ),
      {organization, replay: null, meta: null}
    ).build();
    TraceTree.AutogroupSiblingSpanNodes(tree.root, {organization});
    tree.rebuild();
    const group = tree.list.find(isSiblingAutogroupedNode)!;
    const manager = new VirtualizedViewManager(
      {list: {width: 0.5}, span_list: {width: 0.5}},
      new TraceScheduler(),
      new TraceView(),
      ThemeFixture()
    );
    manager.view.setTraceSpace([0, 0, 1000, 1]);
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
      manager.recomputeTimeCompression();
      manager.recomputeSpanToPXMatrix();
      rerender(
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
    }
  });
});
