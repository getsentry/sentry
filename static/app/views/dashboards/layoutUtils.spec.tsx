import {Layout} from 'react-grid-layout';

import {
  calculateColumnDepths,
  getNextAvailablePosition,
} from 'sentry/views/dashboards/layoutUtils';

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
});
