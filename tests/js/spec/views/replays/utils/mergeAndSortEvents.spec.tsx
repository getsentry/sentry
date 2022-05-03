import mergeAndSortEvents from 'sentry/views/replays/utils/mergeAndSortEvents';

it('merges and sorts multiple lists of events', function () {
  expect(
    mergeAndSortEvents(
      [{type: 0, timestamp: 5}],
      [{type: 1, timestamp: 1}],
      [{type: 2, timestamp: 3}]
    )
  ).toEqual([
    {type: 1, timestamp: 1},
    {type: 2, timestamp: 3},
    {type: 0, timestamp: 5},
  ]);
});
