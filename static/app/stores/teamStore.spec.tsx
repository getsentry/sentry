import {TeamFixture} from 'sentry-fixture/team';

import TeamStore from 'sentry/stores/teamStore';

describe('TeamStore', () => {
  const teamFoo = TeamFixture({
    id: '1',
    slug: 'team-foo',
  });
  const teamBar = TeamFixture({
    id: '2',
    slug: 'team-bar',
  });

  beforeEach(() => {
    TeamStore.reset();
  });

  describe('setting data', () => {
    it('populate teams correctly', () => {
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

    it('loads user teams', () => {
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

    it('stores cursor and hasMore correctly', () => {
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

  describe('updating teams', () => {
    it('adds new teams', async () => {
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

    it('removes teams', async () => {
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

    it('updates teams', async () => {
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
