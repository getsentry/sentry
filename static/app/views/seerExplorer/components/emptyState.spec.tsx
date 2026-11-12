import {getPupilOffset} from './emptyState';

describe('getPupilOffset', () => {
  const bounds = {x: 10, y: 20, width: 500, height: 500};

  it.each([
    [
      {clientX: 263, clientY: 112},
      {x: 0, y: 0},
    ],
    [
      {clientX: 313, clientY: 187},
      {x: 1, y: 1},
    ],
    [
      {clientX: 213, clientY: 37},
      {x: -1, y: -1},
    ],
    [
      {clientX: 10_000, clientY: 10_000},
      {x: 3, y: 2},
    ],
    [
      {clientX: -10_000, clientY: -10_000},
      {x: -3, y: -2},
    ],
  ])('keeps the gaze toward %o within the eye', (pointer, expected) => {
    expect(getPupilOffset(bounds, pointer)).toEqual(expected);
  });
});
