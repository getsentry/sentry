import {createStore} from 'zustand/vanilla';

import type {Team} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';

import {ProjectsStore} from './projectsStore';

interface TeamState {
  readonly cursor: string | null;
  readonly hasMore: boolean | null;
  readonly loadedUserTeams: boolean;
  readonly loading: boolean;
  readonly teams: Team[];
}

const initialState: TeamState = {
  teams: [],
  loadedUserTeams: false,
  loading: true,
  hasMore: null,
  cursor: null,
};

const store = createStore<TeamState>()(() => initialState);

export const TeamStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Same as reset(). Kept for the tests that call it.
   */
  init(): void {
    TeamStore.reset();
  },

  reset(): void {
    store.setState(initialState, true);
  },

  setTeams(teams: Team[], hasMore?: boolean | null, cursor?: string | null): void {
    const state = store.getState();
    store.setState(
      {
        teams,
        loadedUserTeams: defined(hasMore) ? !hasMore : state.loadedUserTeams,
        loading: false,
        hasMore: hasMore ?? state.hasMore,
        cursor: cursor ?? state.cursor,
      },
      true
    );
  },

  loadInitialData(items: Team[], hasMore?: boolean | null, cursor?: string | null): void {
    const teams = TeamStore.updateTeams(items);
    TeamStore.setTeams(teams, hasMore, cursor);
  },

  loadUserTeams(userTeams: Team[]): void {
    const teams = TeamStore.updateTeams(userTeams);
    store.setState({loadedUserTeams: true, teams});
  },

  onUpdateSuccess(itemId: string, response: Team): void {
    if (!response) {
      return;
    }

    const item = TeamStore.getBySlug(itemId);

    if (!item) {
      store.setState(state => ({teams: [...state.teams, response]}));
      return;
    }

    // Slug was changed
    // Note: This is the proper way to handle slug changes but unfortunately not all of our
    // components use stores correctly. To be safe reload browser :((
    if (response.slug !== itemId) {
      // Replace the team
      store.setState(state => ({
        teams: [...state.teams.filter(({slug}) => slug !== itemId), response],
      }));
      return;
    }

    store.setState(state => ({
      teams: state.teams.map(team => (team.slug === response.slug ? response : team)),
    }));
  },

  onRemoveSuccess(slug: string): void {
    const teams = store.getState().teams.filter(team => team.slug !== slug);
    TeamStore.setTeams(teams);
    ProjectsStore.onDeleteTeam(slug);
  },

  onCreateSuccess(team: Team): void {
    TeamStore.loadInitialData([team]);
  },

  getById(id: string): Team | null {
    return (
      store.getState().teams.find(item => item.id.toString() === id.toString()) ?? null
    );
  },

  getBySlug(slug: string): Team | null {
    return store.getState().teams.find(item => item.slug === slug) ?? null;
  },

  getAll(): Team[] {
    return store.getState().teams;
  },

  updateTeams(teams: Team[]): Team[] {
    const teamIdMap = store.getState().teams.reduce((acc: Record<string, Team>, team) => {
      acc[team.id] = team;
      return acc;
    }, {});

    // Replace or insert new user teams
    teams.reduce((acc: Record<string, Team>, userTeam) => {
      acc[userTeam.id] = userTeam;
      return acc;
    }, teamIdMap);

    return Object.values(teamIdMap).sort((a, b) => a.slug.localeCompare(b.slug));
  },
};
