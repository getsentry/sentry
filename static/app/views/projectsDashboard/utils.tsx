/**
 * Noramlize a team slug from the query
 */
export function getTeamParams(team?: string | string[]): string[] {
  if (team === '' || team === undefined) {
    return [];
  }

  if (Array.isArray(team)) {
    return team;
  }

  return [team];
}
