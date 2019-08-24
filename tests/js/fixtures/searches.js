import {Search} from './search';

export function Searches(params = []) {
  return [
    Search({
      name: 'Needs Triage',
      query: 'is:unresolved is:unassigned',
      id: '2',
      isGlobal: true,
    }),
    Search({
      name: 'Unresolved Issues',
      query: 'is:unresolved',
      id: '1',
      isGlobal: true,
    }),
    ...params,
  ];
}
