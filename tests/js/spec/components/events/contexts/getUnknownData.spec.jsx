import getUnknownData from 'app/components/events/contexts/getUnknownData';

describe('getUnknownData', function () {
  it('filters out known data and transforms into the right way', function () {
    const allData = {
      id: 1,
      email: 'a@a.com',
      username: 'a',
      count: 1000,
      type: 'type',
      title: 'title',
    };
    const knownKeys = ['id', 'email'];

    const unknownData = getUnknownData(allData, knownKeys);

    expect(unknownData).toEqual([
      {key: 'username', value: 'a', subject: 'username', meta: undefined},
      {key: 'count', value: 1000, subject: 'count', meta: undefined},
    ]);
  });
});
