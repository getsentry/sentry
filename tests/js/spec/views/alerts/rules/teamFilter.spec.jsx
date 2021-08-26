import {getTeamParams} from 'app/views/alerts/rules/teamFilter';

describe('getTeamParams', () => {
  it('should use default teams', () => {
    expect(getTeamParams()).toEqual(['myteams', 'unassigned']);
  });
  it('should allow no teams with an empty string param', () => {
    expect(getTeamParams('')).toEqual([]);
  });
  it('should allow one or more teams', () => {
    expect(getTeamParams('team-sentry')).toEqual(['team-sentry']);
    expect(getTeamParams(['team-sentry', 'team-two'])).toEqual([
      'team-sentry',
      'team-two',
    ]);
  });
});
