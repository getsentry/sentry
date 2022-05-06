import mergeAndSortEvents from 'sentry/utils/replays/mergeAndSortEvents';

it('merges and sorts multiple lists of events', function () {
  expect(
    mergeAndSortEvents(
      [{type: 0, data: {}, timestamp: 5}],
      [{type: 1, data: {}, timestamp: 1}],
      [{type: 2, data: {}, timestamp: 3}]
    )
  ).toEqual([
    {type: 1, data: {}, timestamp: 1},
    {type: 2, data: {}, timestamp: 3},
    {type: 0, data: {}, timestamp: 5},
  ]);
});
