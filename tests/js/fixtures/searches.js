export function Searches(params = []) {
  return [
    {
      name: 'Needs Triage',
      dateCreated: '2017-11-14T02:22:58.026Z',
      isUserDefault: false,
      isPrivate: false,
      query: 'is:unresolved is:unassigned',
      id: '2',
      isDefault: true,
    },
    {
      name: 'Unresolved Issues',
      dateCreated: '2017-11-14T02:22:58.022Z',
      isUserDefault: true,
      isPrivate: false,
      query: 'is:unresolved',
      id: '1',
      isDefault: false,
    },
    ...params,
  ];
}
