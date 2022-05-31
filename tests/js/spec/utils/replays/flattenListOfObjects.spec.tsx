import flattenListOfObjects from 'sentry/utils/replays/flattenListOfObjects';

test.each([
  [
    [
      {a: [1], b: [2]},
      {a: [2], c: [3]},
    ],
    {a: [1, 2], b: [2], c: [3]},
  ],
  [[{a: [1], b: []}], {a: [1], b: []}],
])('flattenListOfObjects(%p)', (a, expected) => {
  expect(flattenListOfObjects(a)).toEqual(expected);
});

test.each([[[{b: undefined}]]])('flattenListOfObjects throws with value %p', a => {
  expect(() => flattenListOfObjects(a)).toThrow();
});
