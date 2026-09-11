import {WidgetFixture} from 'sentry-fixture/widget';

import {DisplayType} from 'sentry/views/dashboards/types';
import {enforceLayoutMinHeight} from 'sentry/views/dashboards/utils/enforceLayoutMinHeight';

describe('enforceLayoutMinHeight', () => {
  it('expands undersized widgets and compacts widgets affected directly and indirectly', () => {
    // Initial 6-column grid (E grows from one row to two):
    //      0 1 2 3 4 5
    // y=0: E E A A . .
    // y=1: S S . . . .
    // y=2: . P P . . .
    // y=3: I I . . . .
    // E=expanded, S=same-columns, A=separate-columns, P=partial-overlap, I=indirectly-below
    const widgets = [
      WidgetFixture({
        id: 'expanded',
        layout: {x: 0, y: 0, w: 2, h: 1, minH: 1},
      }),
      // Directly below the expanded widget in the same columns.
      WidgetFixture({
        id: 'same-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 1, w: 2, h: 1, minH: 1},
      }),
      // In separate columns and does not need adjustment, so it should not be impacted.
      WidgetFixture({
        id: 'separate-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 2, y: 0, w: 2, h: 1, minH: 1},
      }),
      // Overlaps only half of the expanded widget's columns.
      WidgetFixture({
        id: 'partial-overlap',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 1, y: 2, w: 2, h: 1, minH: 1},
      }),
      // Is displaced indirectly by the widget directly below the expanded one.
      WidgetFixture({
        id: 'indirectly-below',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 3, w: 2, h: 1, minH: 1},
      }),
    ];

    const result = enforceLayoutMinHeight(widgets);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'expanded',
        layout: expect.objectContaining({x: 0, y: 0, w: 2, h: 2, minH: 1}),
      }),
      expect.objectContaining({
        id: 'same-columns',
        layout: expect.objectContaining({x: 0, y: 2, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'separate-columns',
        layout: expect.objectContaining({x: 2, y: 0, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'partial-overlap',
        layout: expect.objectContaining({x: 1, y: 3, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'indirectly-below',
        layout: expect.objectContaining({x: 0, y: 4, w: 2, h: 1, minH: 1}),
      }),
    ]);
  });

  it('expands and compacts multiple undersized widgets', () => {
    // Initial 6-column grid (E grows from one row to two):
    //      0 1 2 3 4 5
    // y=0: E E A A . .
    // y=1: S S B B . .
    // y=2: . P P . . .
    // y=3: I I . . . .
    // E=expanded-left, B=expanded-right, S=same-columns, A=separate-columns, P=partial-overlap, I=indirectly-below
    const widgets = [
      WidgetFixture({
        id: 'expanded-left',
        layout: {x: 0, y: 0, w: 2, h: 1, minH: 1},
      }),
      WidgetFixture({
        id: 'expanded-right',
        layout: {x: 2, y: 1, w: 2, h: 1, minH: 1},
      }),
      // Directly below the expanded-left widget in the same columns.
      WidgetFixture({
        id: 'same-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 1, w: 2, h: 1, minH: 1},
      }),
      // In separate columns and does not need adjustment, so it should not be impacted.
      WidgetFixture({
        id: 'separate-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 2, y: 0, w: 2, h: 1, minH: 1},
      }),
      // Overlaps only half of the expanded widget's columns, shifted down one after adjustment
      WidgetFixture({
        id: 'partial-overlap',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 1, y: 2, w: 2, h: 1, minH: 1},
      }),
      // Is displaced indirectly by the partial overlap widget's shift
      WidgetFixture({
        id: 'indirectly-below',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 3, w: 2, h: 1, minH: 1},
      }),
    ];

    const result = enforceLayoutMinHeight(widgets);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'expanded-left',
        layout: expect.objectContaining({x: 0, y: 0, w: 2, h: 2, minH: 1}),
      }),
      expect.objectContaining({
        id: 'expanded-right',
        layout: expect.objectContaining({x: 2, y: 1, w: 2, h: 2, minH: 1}),
      }),
      expect.objectContaining({
        id: 'same-columns',
        layout: expect.objectContaining({x: 0, y: 2, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'separate-columns',
        layout: expect.objectContaining({x: 2, y: 0, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'partial-overlap',
        layout: expect.objectContaining({x: 1, y: 3, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'indirectly-below',
        layout: expect.objectContaining({x: 0, y: 4, w: 2, h: 1, minH: 1}),
      }),
    ]);
  });

  it('expands and compacts multiple stacked undersized widgets', () => {
    // Initial 6-column grid (E grows from one row to two):
    //      0 1 2 3 4 5
    // y=0: E E A A . .
    // y=1: S S . . . .
    // y=2: . B B . . .
    // y=3: . P P . . .
    // y=4: I I . . . .
    // E=expanded-left, B=expanded-right, S=same-columns, A=separate-columns, P=partial-overlap, I=indirectly-below
    const widgets = [
      WidgetFixture({
        id: 'expanded-left',
        layout: {x: 0, y: 0, w: 2, h: 1, minH: 1},
      }),
      WidgetFixture({
        id: 'expanded-right',
        layout: {x: 1, y: 2, w: 2, h: 1, minH: 1},
      }),
      // Directly below the expanded-left widget in the same columns, shifts one down after expanded-left adjustment
      WidgetFixture({
        id: 'same-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 1, w: 2, h: 1, minH: 1},
      }),
      // In separate columns and does not need adjustment, so it should not be impacted.
      WidgetFixture({
        id: 'separate-columns',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 2, y: 0, w: 2, h: 1, minH: 1},
      }),
      // Overlaps half of expanded-left's columns and all of expanded-right's columns. Shifts down 2 after adjustment, one for each adjusted widget
      WidgetFixture({
        id: 'partial-overlap',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 1, y: 3, w: 2, h: 1, minH: 1},
      }),
      // Is displaced indirectly by the partial overlap widget's shift, will shift down 2
      WidgetFixture({
        id: 'indirectly-below',
        displayType: DisplayType.BIG_NUMBER,
        layout: {x: 0, y: 4, w: 2, h: 1, minH: 1},
      }),
    ];

    const result = enforceLayoutMinHeight(widgets);

    expect(result).toEqual([
      expect.objectContaining({
        id: 'expanded-left',
        layout: expect.objectContaining({x: 0, y: 0, w: 2, h: 2, minH: 1}),
      }),
      expect.objectContaining({
        id: 'expanded-right',
        layout: expect.objectContaining({x: 1, y: 3, w: 2, h: 2, minH: 1}),
      }),
      expect.objectContaining({
        id: 'same-columns',
        layout: expect.objectContaining({x: 0, y: 2, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'separate-columns',
        layout: expect.objectContaining({x: 2, y: 0, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'partial-overlap',
        layout: expect.objectContaining({x: 1, y: 5, w: 2, h: 1, minH: 1}),
      }),
      expect.objectContaining({
        id: 'indirectly-below',
        layout: expect.objectContaining({x: 0, y: 6, w: 2, h: 1, minH: 1}),
      }),
    ]);
  });
});
