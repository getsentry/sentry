import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {TraceScheduler} from 'sentry/views/performance/traceDetails/traceRenderers/traceScheduler';
import {TraceTimeCompression} from 'sentry/views/performance/traceDetails/traceRenderers/traceTimeCompression';
import {TraceView} from 'sentry/views/performance/traceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/traceDetails/traceRenderers/virtualizedViewManager';
import {InvisibleTraceBar} from 'sentry/views/performance/traceDetails/traceRow/traceBar';

describe.each([false, true])('InvisibleTraceBar with compression=%s', compressed => {
  it.each([
    {timestamp: 1000, edge: 'Start'},
    {timestamp: 1001, edge: 'Start'},
    {timestamp: 1500, edge: null},
    {timestamp: 1999, edge: 'End'},
    {timestamp: 2000, edge: 'End'},
  ])('keeps the error icon at $timestamp inside the viewport', ({timestamp, edge}) => {
    const manager = new VirtualizedViewManager(
      {list: {width: 0}, span_list: {width: 1}},
      new TraceScheduler(),
      new TraceView(),
      ThemeFixture()
    );
    manager.view.setTraceSpace([1000, 0, 1000, 1]);
    manager.view.setTracePhysicalSpace([0, 0, 1000, 1], [0, 0, 1000, 1]);
    if (compressed) {
      manager.setTimeCompression(
        TraceTimeCompression.FromVisibleItems({
          enabled: true,
          traceSpace: [1000, 1000],
          physicalWidth: 1000,
          nodes: [
            new EapSpanNode(null, makeEAPSpan({start_timestamp: 1, end_timestamp: 1.1}), {
              organization: OrganizationFixture(),
            }),
            new EapSpanNode(null, makeEAPSpan({start_timestamp: 1.9, end_timestamp: 2}), {
              organization: OrganizationFixture(),
            }),
          ],
          indicators: [],
        })
      );
    }
    manager.recomputeSpanToPXMatrix();

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
    manager.recomputeSpanToPXMatrix();
    manager.drawInvisibleBars();
    if (timestamp === 1500) {
      expect(icon).toHaveClass('TraceIconEnd');
      manager.view.setTraceView({x: 500, width: 500});
      manager.recomputeSpanToPXMatrix();
      manager.drawInvisibleBars();
      expect(icon).toHaveClass('TraceIconStart');
      expect(icon).not.toHaveClass('TraceIconEnd');
    }

    manager.view.setTraceView({x: 0, width: 1000});
    manager.view.setTracePhysicalSpace([0, 0, 500, 1], [0, 0, 500, 1]);
    manager.recomputeSpanToPXMatrix();
    manager.drawInvisibleBars();
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
