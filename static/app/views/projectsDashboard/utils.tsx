import toArray from 'sentry/utils/toArray';

/**
 * Noramlize a team slug from the query
 */
export function getTeamParams(team?: string | string[]): string[] {
  if (team === '' || team === undefined) {
    return [];
  }

  return toArray(team);
}
