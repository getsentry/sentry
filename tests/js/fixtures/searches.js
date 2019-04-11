import {Search} from 'app-test/fixtures/search';

export function Searches(params = []) {
  return [
    Search({
      name: 'Needs Triage',
      query: 'is:unresolved is:unassigned',
      id: '2',
    }),
    Search({
      name: 'Unresolved Issues',
      isUserDefault: true,
      isPrivate: false,
      query: 'is:unresolved',
      id: '1',
      isDefault: false,
    }),
    ...params,
  ];
}
