import {mat3, vec2} from 'gl-matrix';

import type {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {
  calculateScale,
  getDeepestNodeAtPoint,
  getHierarchyDimensions,
} from 'sentry/components/events/viewHierarchy/utils';
import {defined} from 'sentry/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

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

const DEFAULT_MOCK_HIERARCHY = [
  {
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    children: [INTERMEDIATE_NODE],
  },
  {x: 10, y: 0, width: 20, height: 20},
] as ViewHierarchyWindow[];

describe('View Hierarchy Utils', function () {
  let MOCK_HIERARCHY: ViewHierarchyWindow[];
  beforeEach(function () {
    MOCK_HIERARCHY = [...DEFAULT_MOCK_HIERARCHY];
  });

  describe('getHierarchyDimensions', function () {
    it('properly calculates coordinates and shifts children by default', function () {
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

    it('does not shift children when specified', function () {
      const actual = getHierarchyDimensions(MOCK_HIERARCHY, true);

      // One array for each root
      expect(actual).toEqual({
        nodes: [
          {node: MOCK_HIERARCHY[0], rect: new Rect(0, 0, 10, 10)},
          {node: INTERMEDIATE_NODE, rect: new Rect(10, 5, 10, 10)},
          {node: LEAF_NODE, rect: new Rect(2, 2, 5, 5)},
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
      expect(actual).toBe(5);
    });

    it('shrinks larger content', function () {
      maxCoordinateDimensions = {height: 20, width: 20};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toBe(0.5);
    });

    it('works with an irregular size where height is the dominant factor', function () {
      maxCoordinateDimensions = {height: 20, width: 2};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toBe(0.5);
    });

    it('works with an irregular size where width is the dominant factor', function () {
      maxCoordinateDimensions = {height: 10, width: 32};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toBe(0.3125);
    });

    it('factors in the border', function () {
      maxCoordinateDimensions = {height: 20, width: 20};
      border = {x: 2, y: 2};
      actual = calculateScale(bounds, maxCoordinateDimensions, border);
      expect(actual).toBe(0.4);
    });
  });

  describe('getDeepestNodeAtPoint', function () {
    beforeEach(function () {
      MOCK_HIERARCHY = [
        {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          children: [INTERMEDIATE_NODE],
        },
      ] as ViewHierarchyWindow[];
    });

    it('returns the deepest node at a point', function () {
      const hierarchyDimensions = getHierarchyDimensions(MOCK_HIERARCHY);
      const actual = getDeepestNodeAtPoint(
        hierarchyDimensions.nodes,
        [10, 5],
        mat3.create(),
        1
      );

      if (!defined(actual)) {
        throw new Error('Expected a node to be returned');
      }

      expect(actual.node).toEqual(INTERMEDIATE_NODE);
    });

    it('returns the deepest node at a point with a scale', function () {
      const hierarchyDimensions = getHierarchyDimensions(MOCK_HIERARCHY);
      const actual = getDeepestNodeAtPoint(
        hierarchyDimensions.nodes,
        [24, 14],
        mat3.create(),
        0.5
      );

      if (!defined(actual)) {
        throw new Error('Expected a node to be returned');
      }

      expect(actual.node).toEqual(LEAF_NODE);
    });

    it('returns the deepest node at a point with a translation', function () {
      const hierarchyDimensions = getHierarchyDimensions(MOCK_HIERARCHY);
      const actual = getDeepestNodeAtPoint(
        hierarchyDimensions.nodes,
        [22, 17],
        mat3.translate(mat3.create(), mat3.create(), vec2.fromValues(10, 10)), // Translate by 10, 10
        1
      );

      if (!defined(actual)) {
        throw new Error('Expected a node to be returned');
      }

      expect(actual.node).toEqual(LEAF_NODE);
    });

    it('returns the root if the root is clicked', function () {
      const hierarchyDimensions = getHierarchyDimensions([...DEFAULT_MOCK_HIERARCHY]);
      const actual = getDeepestNodeAtPoint(
        hierarchyDimensions.nodes,
        [0, 0],
        mat3.create(),
        1
      );

      if (!defined(actual)) {
        throw new Error('Expected a node to be returned');
      }

      expect(actual.node).toEqual(MOCK_HIERARCHY[0]);
    });

    it('returns null if no node is found', function () {
      const hierarchyDimensions = getHierarchyDimensions(MOCK_HIERARCHY);
      const actual = getDeepestNodeAtPoint(
        hierarchyDimensions.nodes,
        [100, 100], // The click is outside of any nodes
        mat3.create(),
        1
      );

      expect(actual).toBeNull();
    });
  });
});
