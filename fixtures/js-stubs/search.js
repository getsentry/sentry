export function Search(params = {}) {
  return {
    dateCreated: '2017-11-14T02:22:58.026Z',
    isGlobal: false,
    isOrgCustom: false,
    isPinned: false,
    type: 0,

    // deprecated props
    isUserDefault: false,
    isDefault: true,
    isPrivate: false,

    name: 'Needs Triage',
    query: 'is:unresolved is:unassigned',
    id: '2',
    ...params,
  };
}
