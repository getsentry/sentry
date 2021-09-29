import TeamActions from 'app/actions/teamActions';
import TeamStore from 'app/stores/teamStore';

describe('TeamStore', function () {
  const teamFoo = TestStubs.Team({
    slug: 'team-foo',
  });
  const teamBar = TestStubs.Team({
    slug: 'team-bar',
  });

  describe('setting data', function () {
    beforeEach(function () {
      TeamStore.reset();
    });

    it('populate teams correctly', async function () {
      expect(TeamStore.get()).toMatchObject({
        teams: [],
        loading: true,
        hasMore: null,
        loadedUserTeams: false,
      });

      TeamActions.loadTeams([teamFoo, teamBar]);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamBar, teamFoo],
        loading: false,
        hasMore: null,
        loadedUserTeams: true,
      });
    });

    it('loads user teams', async function () {
      expect(TeamStore.get()).toMatchObject({
        teams: [],
        loadedUserTeams: false,
      });

      TeamActions.loadUserTeams([teamFoo]);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamFoo],
        loadedUserTeams: true,
      });
    });
  });

  describe('updating teams', function () {
    it('adds new teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.createTeamSuccess(teamBar);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamBar, teamFoo],
      });
    });

    it('removes teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.removeTeamSuccess(teamFoo.slug);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [],
      });
    });

    it('updates teams', async function () {
      TeamActions.loadTeams([teamFoo]);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamFoo],
      });

      TeamActions.updateSuccess(teamFoo.slug, teamBar);
      await tick();
      expect(TeamStore.get()).toMatchObject({
        teams: [teamBar],
      });
    });
  });
});
