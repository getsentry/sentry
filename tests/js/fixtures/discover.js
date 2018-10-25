export function DiscoverSavedQuery(params) {
  return {
    id: '1',
    name: 'Saved query #1',
    dateCreated: '2018-09-24T00:00:00.000Z',
    dateUpdated: '2018-09-24T00:00:00.000Z',
    fields: ['test'],
    ...params,
  };
}
