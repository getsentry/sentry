import {WidgetFixture} from 'sentry-fixture/widget';

import type {Widget} from 'sentry/views/dashboards/types';

import {spaceWidgetsEquallyOnRow} from './spaceWidgetsEquallyOnRow';

describe('spaceWidgetsEquallyOnRow', () => {
  it('should space widgets equally on a row', () => {
    const widgets: Widget[] = [WidgetFixture({id: '1'}), WidgetFixture({id: '2'})];

    const result = spaceWidgetsEquallyOnRow(widgets, 0);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: '1',
        layout: expect.objectContaining({x: 0, y: 0, w: 3, h: 2}),
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: '2',
        layout: expect.objectContaining({x: 3, y: 0, w: 3, h: 2}),
      })
    );
  });

  it('should throw an error if there are more widgets than the number of columns', () => {
    const widgets: Widget[] = Array.from({length: 7}, (_, i) =>
      WidgetFixture({id: `widget-${i}`})
    );

    expect(() => spaceWidgetsEquallyOnRow(widgets, 0)).toThrow(
      'Expected no more than 6 widgets, got 7'
    );
  });
});
