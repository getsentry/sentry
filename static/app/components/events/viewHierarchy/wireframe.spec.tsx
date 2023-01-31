import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {getCoordinates} from 'sentry/components/events/viewHierarchy/wireframe';

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
];

describe('View Hierarchy Wireframe', function () {
  it('properly calculates coordinates', function () {
    const actual = getCoordinates(MOCK_HIERARCHY as ViewHierarchyWindow[]);

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
