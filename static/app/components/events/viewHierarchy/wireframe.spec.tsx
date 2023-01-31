import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {
  calculateScale,
  getCoordinates,
  getMaxDimensions,
} from 'sentry/components/events/viewHierarchy/wireframe';

const MOCK_HIERARCHY = [
  {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    children: [
      {
        x: 10,
        y: 5,
        width: 10,
        height: 10,
        children: [
          {
            x: 2,
            y: 2,
            width: 5,
            height: 5,
          },
        ],
      },
    ],
  },
  {x: 10, y: 0, width: 20, height: 20},
] as ViewHierarchyWindow[];

describe('View Hierarchy Wireframe', function () {
  describe('getCoordinates', function () {
    it('properly calculates coordinates', function () {
      const actual = getCoordinates(MOCK_HIERARCHY);

      // One array for each root
      expect(actual).toEqual([
        [
          {x: 0, y: 0, width: 10, height: 10},
          {x: 10, y: 5, width: 10, height: 10},
          {x: 12, y: 7, width: 5, height: 5},
        ],
        [{x: 10, y: 0, width: 20, height: 20}],
      ]);
    });
  });

  describe('maxDimensions', function () {
    it('calculates the max dimensions needed to render the contents in frame', function () {
      const coordinates = getCoordinates(MOCK_HIERARCHY);
      const actual = getMaxDimensions(coordinates);

      expect(actual).toEqual({
        width: 30,
        height: 20,
      });
    });
  });

  describe('calculateScale', function () {
    const bounds = {
      height: 10,
      width: 10,
    };
    const border = {x: 0, y: 0};

    let maxCoordinateDimensions, actual;

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
  });
});
