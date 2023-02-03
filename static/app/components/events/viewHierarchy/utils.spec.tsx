import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {
  calculateScale,
  getHierarchyDimensions,
} from 'sentry/components/events/viewHierarchy/utils';
import {Rect} from 'sentry/utils/profiling/gl/utils';

const LEAF_NODE = {
  x: 2,
  y: 2,
  width: 5,
  height: 5,
};
const INTERMEDIATE_NODE = {
  x: 10,
  y: 5,
  width: 10,
  height: 10,
  children: [LEAF_NODE],
};

const MOCK_HIERARCHY = [
  {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    children: [INTERMEDIATE_NODE],
  },
  {x: 10, y: 0, width: 20, height: 20},
] as ViewHierarchyWindow[];

describe('View Hierarchy Wireframe', function () {
  describe('getHierarchyDimensions', function () {
    it('properly calculates coordinates', function () {
      const actual = getHierarchyDimensions(MOCK_HIERARCHY);

      expect(actual).toEqual({
        nodes: [
          {node: MOCK_HIERARCHY[0], rect: new Rect(0, 0, 10, 10)},
          {node: INTERMEDIATE_NODE, rect: new Rect(10, 5, 10, 10)},
          {node: LEAF_NODE, rect: new Rect(12, 7, 5, 5)},
          {node: MOCK_HIERARCHY[1], rect: new Rect(10, 0, 20, 20)},
        ],
        maxWidth: 30,
        maxHeight: 20,
      });
    });
  });

  describe('calculateScale', function () {
    let maxCoordinateDimensions: {height: number; width: number},
      actual: number,
      border: {x: number; y: number};

    const bounds = {
      height: 10,
      width: 10,
    };

    beforeEach(function () {
      border = {x: 0, y: 0};
    });

    it('zooms in on small content', function () {
      maxCoordinateDimensions = {height: 2, width: 2};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toEqual(5);
    });

    it('shrinks larger content', function () {
      maxCoordinateDimensions = {height: 20, width: 20};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toEqual(0.5);
    });

    it('works with an irregular size where height is the dominant factor', function () {
      maxCoordinateDimensions = {height: 20, width: 2};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toEqual(0.5);
    });

    it('works with an irregular size where width is the dominant factor', function () {
      maxCoordinateDimensions = {height: 10, width: 32};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toEqual(0.3125);
    });

    it('factors in the border', function () {
      maxCoordinateDimensions = {height: 20, width: 20};
      border = {x: 2, y: 2};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toEqual(0.4);
    });
  });
});
