import {parseAsStringLiteral, useQueryState} from 'nuqs';

const ASSIGNMENT_QUERY_PARAM = 'assignment';
const ASSIGNMENT_FILTERS = ['my_teams', 'all'] as const;

export type AssignmentFilter = (typeof ASSIGNMENT_FILTERS)[number];

export const assignmentFilterParser =
  parseAsStringLiteral(ASSIGNMENT_FILTERS).withDefault('my_teams');

export function useAssignmentFilter() {
  return useQueryState(
    ASSIGNMENT_QUERY_PARAM,
    assignmentFilterParser.withOptions({history: 'replace'})
  );
}
