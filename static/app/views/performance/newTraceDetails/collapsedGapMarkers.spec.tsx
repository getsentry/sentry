import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SpanNode} from './traceModels/traceTreeNode/spanNode';
import {makeSpan} from './traceModels/traceTreeTestUtils';
import {TraceScheduler} from './traceRenderers/traceScheduler';
import {TraceView} from './traceRenderers/traceView';
import {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {CollapsedGapMarkers} from './collapsedGapMarkers';

function setup() {
  const scheduler = new TraceScheduler();
  const manager = new VirtualizedViewManager(
    {list: {width: 0.5}, span_list: {width: 0.5}},
    scheduler,
    new TraceView(),
    ThemeFixture()
  );
  manager.view.setTraceSpace([0, 0, 1000, 1]);
  manager.view.setTracePhysicalSpace([0, 0, 2000, 1], [0, 0, 1000, 1]);
  const options = {
    enabled: true,
    traceSpace: [0, 1000] satisfies [number, number],
    indicators: [],
    nodes: [0, 0.3, 0.9].map(
      start =>
        new SpanNode(
          null,
          makeSpan({start_timestamp: start, timestamp: start + 0.1}),
          null
        )
    ),
  };
  manager.timeCompressionOptions = options;
  manager.recomputeTimeCompression();
  scheduler.on('set trace view', () => manager.draw());
  scheduler.on('divider resize', view => manager.draw(view));

  const {unmount} = render(
    <div
      ref={ref => {
        manager.container = ref;
      }}
    >
      <div ref={manager.registerDividerRef} data-test-id="divider" />
      <CollapsedGapMarkers manager={manager} scrollContainer={null} />
    </div>
  );
  return {manager, options, unmount};
}

describe('CollapsedGapMarkers', () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(40);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reconciles markers, tooltips and label overlap while dragging across the collapse threshold', async () => {
    const user = userEvent.setup();
    const {manager} = setup();
    const divider = screen.getByTestId('divider');
    expect(screen.getByText('104.00ms')).toBeInTheDocument();
    expect(screen.getByText('404.00ms')).toBeInTheDocument();

    await user.pointer({target: divider, keys: '[MouseLeft>]', coords: {x: 1000, y: 0}});
    await user.pointer({target: divider, coords: {x: 1500, y: 0}});

    expect(manager.view.trace_physical_space.width).toBe(500);
    expect(screen.queryAllByText(/^\d+\.\d{2}ms$/)).toHaveLength(1);
    expect(screen.queryByText('104.00ms')).not.toBeInTheDocument();
    expect(screen.queryByText('404.00ms')).not.toBeInTheDocument();
    const pill = screen.getByText('308.00ms');
    expect(manager.container?.style.getPropertyValue('--span-column-width')).toBe('0.25');
    expect(manager.columns.span_list.width).toBe(0.5);
    expect(manager.dividerStartVec).not.toBeNull();

    const marker = manager.collapsed_gap_markers[0]!;
    const markerLeft = Number.parseFloat(
      marker.ref.style.transform.replace('translateX(', '')
    );
    expect(markerLeft + 20).toBeCloseTo(
      (manager.transformXFromTimestamp(496) + manager.transformXFromTimestamp(804)) / 2
    );
    const phantomLeft = manager.transformXFromTimestamp(200) - 20;
    const indicator = document.createElement('div');
    indicator.appendChild(document.createElement('div'));
    expect(manager.spanTextOverlapsCollapsedGap(phantomLeft, 20)).toBe(false);
    expect(
      manager.timelineIndicatorOverlapsCollapsedGapMarker(indicator, phantomLeft)
    ).toBe(false);
    expect(manager.spanTextOverlapsCollapsedGap(markerLeft, 20)).toBe(true);
    expect(
      manager.timelineIndicatorOverlapsCollapsedGapMarker(indicator, markerLeft)
    ).toBe(true);

    await user.hover(pill);
    expect(
      await screen.findByText('Skipped 308.00ms inactive period')
    ).toBeInTheDocument();
    await user.unhover(pill);

    // Bounds and text must update even when the marker count does not change.
    await user.pointer({target: divider, coords: {x: 1450, y: 0}});
    expect(screen.queryAllByText(/^\d+\.\d{2}ms$/)).toHaveLength(1);
    expect(screen.getByText('325.45ms')).toBeInTheDocument();
    expect(screen.queryByText('308.00ms')).not.toBeInTheDocument();

    // Drag back without releasing the mouse: the vanished gap must return.
    await user.pointer({target: divider, coords: {x: 1000, y: 0}});
    expect(screen.queryAllByText(/^\d+\.\d{2}ms$/)).toHaveLength(2);
    expect(screen.getByText('104.00ms')).toBeInTheDocument();
    expect(screen.getByText('404.00ms')).toBeInTheDocument();
    expect(manager.container?.style.getPropertyValue('--span-column-width')).toBe('0.5');
    await user.pointer({target: divider, keys: '[/MouseLeft]', coords: {x: 1000, y: 0}});
    expect(manager.dividerStartVec).toBeNull();
  });

  it('clears markers and overlap when compression is disabled and recreates them when enabled', () => {
    const {manager, options, unmount} = setup();
    const markerLeft = Number.parseFloat(
      manager.collapsed_gap_markers[0]!.ref.style.transform.replace('translateX(', '')
    );
    expect(manager.spanTextOverlapsCollapsedGap(markerLeft, 20)).toBe(true);
    act(() => manager.recomputeTimeCompression({...options, enabled: false}));
    expect(screen.queryAllByText(/^\d+\.\d{2}ms$/)).toHaveLength(0);
    expect(manager.collapsed_gap_markers.filter(Boolean)).toHaveLength(0);
    expect(manager.spanTextOverlapsCollapsedGap(markerLeft, 20)).toBe(false);

    act(() => manager.recomputeTimeCompression(options));
    expect(screen.queryAllByText(/^\d+\.\d{2}ms$/)).toHaveLength(2);
    expect(manager.spanTextOverlapsCollapsedGap(markerLeft, 20)).toBe(true);
    unmount();
    expect(manager.collapsed_gap_markers.filter(Boolean)).toHaveLength(0);
    expect(manager.spanTextOverlapsCollapsedGap(markerLeft, 20)).toBe(false);
  });
});
