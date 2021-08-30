import {Search} from './search';

export function Searches(params = []) {
  return [
    Search({
      name: 'Needs Triage',
      query: 'is:unresolved is:unassigned',
      sort: 'date',
      id: '2',
      isGlobal: true,
    }),
    Search({
      name: 'Unresolved Issues',
      query: 'is:unresolved',
      sort: 'date',
      id: '1',
      isGlobal: true,
    }),
    ...params,
  ];
}
