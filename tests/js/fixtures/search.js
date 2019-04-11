export function Search(params = {}) {
  return {
    dateCreated: '2017-11-14T02:22:58.026Z',
    isUserDefault: false,
    isPrivate: false,
    isDefault: true,

    name: 'Needs Triage',
    query: 'is:unresolved is:unassigned',
    id: '2',
    ...params,
  };
}
