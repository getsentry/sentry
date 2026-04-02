import {applySeerWidgetDefaults} from 'sentry/views/dashboards/createFromSeerUtils';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';

function makeWidget(overrides: Partial<Widget> = {}): Widget {
  return {
    displayType: DisplayType.LINE,
    interval: '1h',
    title: 'Test Widget',
    queries: [
      {
        name: '',
        conditions: '',
        aggregates: ['count()'],
        columns: [],
        fields: ['count()'],
        orderby: '',
      },
    ],
    ...overrides,
  };
}

describe('applySeerWidgetDefaults', () => {
  describe('layout defaults', () => {
    it('fills in a full default layout when layout is undefined', () => {
      const widgets = [makeWidget({layout: undefined})];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.layout).toEqual({x: 0, y: 0, w: 2, h: 2, minH: 2});
    });

    it('fills in minH when it is missing from an existing layout', () => {
      const widgets = [
        makeWidget({
          layout: {x: 1, y: 2, w: 3, h: 4} as Widget['layout'],
        }),
      ];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.layout).toEqual({x: 1, y: 2, w: 3, h: 4, minH: 2});
    });
  });

  describe('limit defaults', () => {
    it('fills in default limit when limit is undefined', () => {
      const widgets = [makeWidget({limit: undefined})];
      const [result] = applySeerWidgetDefaults(widgets);

      expect(result!.limit).toBe(5);
    });
  });
});
