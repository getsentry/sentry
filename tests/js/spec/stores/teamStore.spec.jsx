import TeamActions from 'sentry/actions/teamActions';
import TeamStore from 'sentry/stores/teamStore';

describe('TeamStore', function () {
  const teamFoo = TestStubs.Team({
    id: '1',
    slug: 'team-foo',
  });
  const teamBar = TestStubs.Team({
    id: '2',
    slug: 'team-bar',
  });

  beforeEach(function () {
    TeamStore.reset();
  });

  describe('setting data', function () {
    it('populate teams correctly', async function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        loading: true,
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });

      TeamActions.loadTeams([teamFoo, teamBar]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar, teamFoo],
        loading: false,
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });
    });

    it('loads user teams', async function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        loadedUserTeams: false,
      });

      TeamActions.loadUserTeams([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
        loadedUserTeams: true,
      });
    });

    it('stores cursor and hasMore correctly', async function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });

      TeamActions.loadTeams([teamFoo], false, null);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
        hasMore: false,
        cursor: null,
        loadedUserTeams: true,
      });
    });
  });

  describe('updating teams', function () {
    it('adds new teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.createTeamSuccess(teamBar);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar, teamFoo],
      });
    });

    it('removes teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.removeTeamSuccess(teamFoo.slug);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
      });
    });

    it('updates teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.updateSuccess(teamFoo.slug, teamBar);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar],
      });
    });
  });
});
