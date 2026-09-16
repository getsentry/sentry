import {ThemeFixture} from 'sentry-fixture/theme';

import {TraceScheduler} from './traceRenderers/traceScheduler';
import {TraceView} from './traceRenderers/traceView';
import {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {TraceColumnLayout} from './traceColumnLayout';

describe('pinned trace columns', () => {
  beforeEach(() => localStorage.clear());

  it('takes width proportionally and resizes only adjacent columns', () => {
    const layout = new TraceColumnLayout(0.5);
    expect(layout.sizes(1000)).toEqual({list: 400, attribute: 200, span_list: 400});
    layout.resize('left', 50, 1000);
    expect(layout.sizes(1000)).toEqual({list: 450, attribute: 150, span_list: 400});
    layout.resize('right', 100, 1000);
    expect(layout.sizes(1000)).toEqual({list: 450, attribute: 250, span_list: 300});
  });

  it('clamps both dividers at the neighboring minimum widths', () => {
    const layout = new TraceColumnLayout(0.5);
    layout.resize('left', 1000, 1000);
    expect(layout.sizes(1000)).toEqual({list: 500, attribute: 100, span_list: 400});
    layout.resize('left', -1000, 1000);
    expect(layout.sizes(1000)).toEqual({list: 120, attribute: 480, span_list: 400});
    layout.resize('right', 1000, 1000);
    expect(layout.sizes(1000)).toEqual({list: 120, attribute: 780, span_list: 100});
    layout.resize('right', -1000, 1000);
    expect(layout.sizes(1000)).toEqual({list: 120, attribute: 100, span_list: 780});
  });

  it('temporarily shrinks in a narrow viewport and restores saved preferences', () => {
    const layout = new TraceColumnLayout(0.5);
    layout.resize('right', 100, 1000);
    layout.save();
    expect(layout.sizes(320)).toEqual({list: 120, attribute: 100, span_list: 100});
    expect(layout.sizes(200)).toEqual(layout.sizes(320));
    const restored = new TraceColumnLayout(0.8);
    expect(restored.sizes(1000)).toEqual({list: 400, attribute: 300, span_list: 300});
  });

  it('updates the timeline coordinate space and restores the two-column ratio on unpin', () => {
    const manager = new VirtualizedViewManager(
      {list: {width: 0.5}, span_list: {width: 0.5}},
      new TraceScheduler(),
      new TraceView(),
      ThemeFixture()
    );
    manager.view.setTracePhysicalSpace([0, 0, 1015, 500], [0, 0, 500, 500]);
    manager.scrollbar_width = 15;
    manager.view.setTraceSpace([0, 0, 1000, 1]);
    manager.view.setTraceView({x: 100, width: 500});
    manager.setAttributePinningEnabled(true);
    manager.setPinnedColumnEnabled(true);
    expect(manager.view.trace_physical_space.width).toBe(400);
    manager.resizePinnedColumn('left', 50);
    expect(manager.view.trace_physical_space.width).toBe(400);
    manager.resizePinnedColumn('right', 100);
    expect(manager.view.trace_physical_space.width).toBe(300);
    expect(manager.columns.attribute.width).toBe(0.25);
    manager.setPinnedColumnEnabled(false);
    expect(manager.columns.list.width).toBeCloseTo(0.6);
    expect(manager.columns.span_list.width).toBeCloseTo(0.4);
    expect(manager.view.trace_view.serialize()).toEqual([100, 0, 500, 1]);
    const reopened = new VirtualizedViewManager(
      {list: {width: 0.5}, span_list: {width: 0.5}},
      new TraceScheduler(),
      new TraceView(),
      ThemeFixture()
    );
    reopened.setAttributePinningEnabled(true);
    expect(reopened.columns.list.width).toBeCloseTo(0.6);
    reopened.setPinnedColumnEnabled(true);
    expect(reopened.columns.attribute.width).toBeCloseTo(0.25);
  });
});
