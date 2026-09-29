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
