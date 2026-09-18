import {parseAsStringLiteral, useQueryState} from 'nuqs';

const ASSIGNMENT_QUERY_PARAM = 'assignment';
const ASSIGNMENT_FILTERS = ['my_teams', 'subscribed', 'all'] as const;

export type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number];

export function useAssignmentFilter() {
  return useQueryState(
    ASSIGNMENT_QUERY_PARAM,
    parseAsStringLiteral(ASSIGNMENT_FILTERS)
      .withDefault('my_teams')
      .withOptions({history: 'replace'})
  );
}
