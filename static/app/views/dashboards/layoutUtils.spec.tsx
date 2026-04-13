import type {Layout} from 'react-grid-layout';
import * as Sentry from '@sentry/react';

import {clampWidgetLayout} from 'sentry/views/dashboards/clampWidgetLayout';
import {
  assignDefaultLayout,
  calculateColumnDepths,
  getDashboardLayout,
  getNextAvailablePosition,
} from 'sentry/views/dashboards/layoutUtils';
import {DisplayType} from 'sentry/views/dashboards/types';

jest.mock('@sentry/react');

describe('Dashboards > Utils', () => {
  describe('calculateColumnDepths', () => {
    it('returns 0s when layouts is empty', () => {
      const expectedColumnDepths = [0, 0, 0, 0, 0, 0];
      const columnDepths = calculateColumnDepths([]);

      expect(columnDepths).toEqual(expectedColumnDepths);
    });

    it('returns the depth of layouts at the same level', () => {
      const layout = [
        {x: 0, y: 0, w: 1, h: 3},
        {x: 1, y: 0, w: 2, h: 2},
        {x: 4, y: 0, w: 2, h: 4},
      ] as Layout[];
      const expectedColumnDepths = [3, 2, 2, 0, 4, 4];
      const columnDepths = calculateColumnDepths(layout);

      expect(columnDepths).toEqual(expectedColumnDepths);
    });

    it('ignores any "space" above and returns the depth of a lower widget', () => {
      const layout = [{x: 0, y: 6, w: 2, h: 3}] as Layout[];
      const expectedColumnDepths = [9, 9, 0, 0, 0, 0];
      const columnDepths = calculateColumnDepths(layout);

      expect(columnDepths).toEqual(expectedColumnDepths);
    });
  });

  describe('getNextAvailablePosition', () => {
    it('returns 0, 0 when there is space for a widget in the top left', () => {
      const columnDepths = [0, 0, 1, 1, 0, 0];
      const expectedPosition = {x: 0, y: 0};
      const expectedNextColumnDepths = [2, 2, 1, 1, 0, 0];

      const [position, nextColumnDepths] = getNextAvailablePosition(columnDepths, 2);

      expect(position).toEqual(expectedPosition);
      expect(nextColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('returns the middle position if there is space', () => {
      const columnDepths = [1, 1, 0, 0, 1, 1];
      const expectedPosition = {x: 2, y: 0};
      const expectedNextColumnDepths = [1, 1, 2, 2, 1, 1];

      const [position, nextColumnDepths] = getNextAvailablePosition(columnDepths, 2);

      expect(position).toEqual(expectedPosition);
      expect(nextColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('returns top right if there is space', () => {
      const columnDepths = [1, 1, 1, 1, 0, 0];
      const expectedPosition = {x: 4, y: 0};
      const expectedNextColumnDepths = [1, 1, 1, 1, 2, 2];

      const [position, nextColumnDepths] = getNextAvailablePosition(columnDepths, 2);

      expect(position).toEqual(expectedPosition);
      expect(nextColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('returns next row if there is no space', () => {
      const columnDepths = [1, 1, 1, 1, 1, 1];
      const expectedPosition = {x: 0, y: 1};
      const expectedNextColumnDepths = [3, 3, 1, 1, 1, 1];

      const [position, nextColumnDepths] = getNextAvailablePosition(columnDepths, 2);

      expect(position).toEqual(expectedPosition);
      expect(nextColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('returns the next column depth for multiple sequential calculations', () => {
      const initialColumnDepths = [1, 1, 1, 1, 0, 0];
      const expectedPosition = {x: 0, y: 1};
      const expectedNextColumnDepths = [3, 3, 1, 1, 2, 2];

      // Call it twice and pass the output of the first into the second
      const [_, intermediateDepths] = getNextAvailablePosition(initialColumnDepths, 2);
      const [position, finalColumnDepths] = getNextAvailablePosition(
        intermediateDepths,
        2
      );

      expect(position).toEqual(expectedPosition);
      expect(finalColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('returns proper next column depth with different height', () => {
      const columnDepths = [1, 1, 1, 1, 1, 1];
      const expectedPosition = {x: 0, y: 1};
      const expectedNextColumnDepths = [5, 5, 1, 1, 1, 1];

      const [position, nextColumnDepths] = getNextAvailablePosition(columnDepths, 4);

      expect(position).toEqual(expectedPosition);
      expect(nextColumnDepths).toEqual(expectedNextColumnDepths);
    });

    it('does not mutate its input array', () => {
      const columnDepths = [1, 1, 1, 1, 1, 1];

      getNextAvailablePosition(columnDepths, 4);

      expect(columnDepths).toEqual([1, 1, 1, 1, 1, 1]);
    });
  });

  describe('clampWidgetLayout', () => {
    it('returns valid layouts unchanged', () => {
      const layout = {x: 0, y: 0, w: 2, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual(layout);
    });

    it('clamps width exceeding grid columns', () => {
      const layout = {x: 0, y: 0, w: 12, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual({x: 0, y: 0, w: 6, h: 2, minH: 2});
    });

    it('clamps x + w exceeding grid columns', () => {
      const layout = {x: 4, y: 0, w: 4, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual({x: 4, y: 0, w: 2, h: 2, minH: 2});
    });

    it('clamps negative x to 0', () => {
      const layout = {x: -1, y: 0, w: 2, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual({x: 0, y: 0, w: 2, h: 2, minH: 2});
    });

    it('clamps width of 0 to 1', () => {
      const layout = {x: 0, y: 0, w: 0, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual({x: 0, y: 0, w: 1, h: 2, minH: 2});
    });

    it('clamps x beyond last column', () => {
      const layout = {x: 10, y: 0, w: 2, h: 2, minH: 2};
      expect(clampWidgetLayout(layout)).toEqual({x: 5, y: 0, w: 1, h: 2, minH: 2});
    });
  });

  describe('getDashboardLayout', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('clamps oversized widget layouts', () => {
      const widgets = [
        {
          displayType: DisplayType.LINE,
          interval: '5m',
          title: 'Test',
          queries: [],
          id: '1',
          layout: {x: 0, y: 0, w: 12, h: 2, minH: 2},
        },
      ];
      const layouts = getDashboardLayout(widgets);
      expect(layouts[0]).toEqual(
        expect.objectContaining({x: 0, y: 0, w: 6, h: 2, minH: 2})
      );
    });

    it('logs to Sentry when layout is clamped', () => {
      const widgets = [
        {
          displayType: DisplayType.LINE,
          interval: '5m',
          title: 'Test',
          queries: [],
          id: '1',
          layout: {x: 0, y: 0, w: 12, h: 2, minH: 2},
        },
      ];
      getDashboardLayout(widgets);
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Invalid widget layout dimensions detected',
        expect.objectContaining({extra: expect.any(Object)})
      );
    });

    it('does not log to Sentry for valid layouts', () => {
      const widgets = [
        {
          displayType: DisplayType.LINE,
          interval: '5m',
          title: 'Test',
          queries: [],
          id: '1',
          layout: {x: 0, y: 0, w: 2, h: 2, minH: 2},
        },
      ];
      getDashboardLayout(widgets);
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });
  });

  describe('assignDefaultLayout', () => {
    it('clamps existing oversized layouts', () => {
      const widgets = [
        {
          displayType: DisplayType.LINE,
          layout: {x: 0, y: 0, w: 12, h: 2, minH: 2},
        },
      ];
      const result = assignDefaultLayout(widgets, [0, 0, 0, 0, 0, 0]);
      expect(result[0]!.layout).toEqual({x: 0, y: 0, w: 6, h: 2, minH: 2});
    });
  });
});
