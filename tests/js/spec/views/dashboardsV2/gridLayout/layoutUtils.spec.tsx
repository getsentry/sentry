import {Layout} from 'react-grid-layout';

import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  calculateColumnDepths,
  getNextAvailablePosition,
  getWidgetComparisonSizes,
  trackDashboardResizes,
} from 'sentry/views/dashboardsV2/layoutUtils';
import {DisplayType} from 'sentry/views/dashboardsV2/types';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('Dashboards > Utils', () => {
  describe('calculateColumnDepths', () => {
    it('returns 0s when layouts is empty', () => {
      const layout = [];
      const expectedColumnDepths = [0, 0, 0, 0, 0, 0];
      const columnDepths = calculateColumnDepths(layout);

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

  describe('getWidgetComparisonSizes', () => {
    // @ts-ignore
    const testNewWidget = TestStubs.Widget(
      [{name: '', conditions: 'event.type:error', fields: ['count()']}],
      {
        id: '1',
        title: 'Default Widget 1',
        interval: '1d',
        layout: {x: 0, y: 0, w: 3, h: 4},
      }
    );

    it('returns the size of the new widget and the previous widget if one matches', () => {
      // @ts-ignore
      const testPrevWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 6, h: 6},
        }
      );

      const {newSize, previousSize} = getWidgetComparisonSizes(testNewWidget, [
        testPrevWidget,
      ]);

      expect(newSize).toEqual({w: 3, h: 4});
      expect(previousSize).toEqual({w: 6, h: 6});
    });

    it.each`
      displayType               | expectedHeight
      ${DisplayType.BIG_NUMBER} | ${1}
      ${DisplayType.AREA}       | ${2}
    `(
      'returns a previousSize using the display type of the new widget if there is no previous match',
      ({displayType, expectedHeight}) => {
        // @ts-ignore
        const newBigNumberWidget = TestStubs.Widget(
          [{name: '', conditions: 'event.type:error', fields: ['count()']}],
          {
            id: '1',
            title: 'Default Widget 1',
            interval: '1d',
            displayType,
            layout: {x: 0, y: 0, w: 3, h: 4},
          }
        );
        const {newSize, previousSize} = getWidgetComparisonSizes(newBigNumberWidget, []);

        expect(newSize).toEqual({w: 3, h: 4});
        expect(previousSize).toEqual({w: 2, h: expectedHeight});
      }
    );

    it.each`
      displayType               | expectedHeight
      ${DisplayType.BIG_NUMBER} | ${1}
      ${DisplayType.AREA}       | ${2}
    `(
      'returns the default size for a display type when there is a match but no previous layout',
      ({displayType, expectedHeight}) => {
        // @ts-ignore
        const testPrevWidget = TestStubs.Widget(
          [{name: '', conditions: 'event.type:error', fields: ['count()']}],
          {
            id: '1',
            title: 'Default Widget 1',
            interval: '1d',
            layout: null,
            displayType,
          }
        );

        const {newSize, previousSize} = getWidgetComparisonSizes(testNewWidget, [
          testPrevWidget,
        ]);

        expect(newSize).toEqual({w: 3, h: 4});
        expect(previousSize).toEqual({w: 2, h: expectedHeight});
      }
    );
  });

  describe('trackDashboardResize', () => {
    let organization;

    beforeEach(() => {
      jest.clearAllMocks();
      organization = TestStubs.Organization();
    });

    it('does not send a tracking event if no resize occurred', () => {
      // @ts-ignore
      const previousWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 2, h: 2},
          displayType: DisplayType.BIG_NUMBER,
        }
      );
      trackDashboardResizes(organization, [previousWidget], [previousWidget]);
      expect(trackAdvancedAnalyticsEvent).not.toHaveBeenCalled();
    });

    it('sends a tracking event if resize occurred', () => {
      // @ts-ignore
      const previousWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 2, h: 2},
          displayType: DisplayType.BIG_NUMBER,
        }
      );
      // @ts-ignore
      const nextWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 4, h: 1},
          displayType: DisplayType.BIG_NUMBER,
        }
      );
      trackDashboardResizes(organization, [previousWidget], [nextWidget]);
      expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledWith(
        'dashboards_views.widget.resize',
        {
          organization,
          displayType: DisplayType.BIG_NUMBER,
          height: 'smaller',
          width: 'larger',
        }
      );
    });

    it('sends multiple tracking events with multiple widgets', () => {
      // @ts-ignore
      const previousWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 2, h: 2},
          displayType: DisplayType.BIG_NUMBER,
        }
      );
      // @ts-ignore
      const nextWidget = TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          id: '1',
          title: 'Default Widget 1',
          interval: '1d',
          layout: {x: 0, y: 0, w: 4, h: 1},
          displayType: DisplayType.BIG_NUMBER,
        }
      );
      trackDashboardResizes(
        organization,
        [previousWidget],
        [nextWidget, {...nextWidget, id: '2'}] // Override the id as if a new widget was added
      );
      expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledTimes(2);
    });
  });
});
