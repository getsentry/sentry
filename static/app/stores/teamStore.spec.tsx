import {Team} from 'sentry-fixture/team';

import TeamStore from 'sentry/stores/teamStore';

describe('TeamStore', function () {
  const teamFoo = Team({
    id: '1',
    slug: 'team-foo',
  });
  const teamBar = Team({
    id: '2',
    slug: 'team-bar',
  });

  beforeEach(function () {
    TeamStore.reset();
  });

  describe('setting data', function () {
    it('populate teams correctly', function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        loading: true,
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });

      TeamStore.loadInitialData([teamFoo, teamBar]);
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar, teamFoo],
        loading: false,
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });
    });

    it('loads user teams', function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        loadedUserTeams: false,
      });

      TeamStore.loadUserTeams([teamFoo]);
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
        loadedUserTeams: true,
      });
    });

    it('stores cursor and hasMore correctly', function () {
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
        hasMore: null,
        cursor: null,
        loadedUserTeams: false,
      });

      TeamStore.loadInitialData([teamFoo], false, null);
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
      TeamStore.loadInitialData([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamStore.onCreateSuccess(teamBar);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar, teamFoo],
      });
    });

    it('removes teams', async function () {
      TeamStore.loadInitialData([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamStore.onRemoveSuccess(teamFoo.slug);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [],
      });
    });

    it('updates teams', async function () {
      TeamStore.loadInitialData([teamFoo]);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamFoo],
      });

      TeamStore.onUpdateSuccess(teamFoo.slug, teamBar);
      await tick();
      expect(TeamStore.getState()).toMatchObject({
        teams: [teamBar],
      });
    });
  });
});
