import {createStore} from 'zustand';

import type {Team} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';

import {ProjectsStore} from './projectsStore';

type State = {
  cursor: string | null;
  hasMore: boolean | null;
  loadedUserTeams: boolean;
  loading: boolean;
  teams: Team[];
};

const initialState: State = {
  teams: [],
  loadedUserTeams: false,
  loading: true,
  hasMore: null,
  cursor: null,
};

const store = createStore<State>()(() => initialState);

function updateTeams(teams: Team[]) {
  const teamIdMap = store
    .getState()
    .teams.reduce((acc: Record<string, Team>, team: Team) => {
      acc[team.id] = team;
      return acc;
    }, {});

  // Replace or insert new user teams
  teams.reduce((acc: Record<string, Team>, userTeam: Team) => {
    acc[userTeam.id] = userTeam;
    return acc;
  }, teamIdMap);

  return Object.values(teamIdMap).sort((a, b) => a.slug.localeCompare(b.slug));
}

export const TeamStore = {
  ...store,
  initialized: false,

  init() {
    TeamStore.reset();
  },

  reset() {
    store.setState(initialState, true);
  },

  setTeams(teams: Team[], hasMore?: boolean | null, cursor?: string | null) {
    TeamStore.initialized = true;
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

  loadInitialData(items: Team[], hasMore?: boolean | null, cursor?: string | null) {
    TeamStore.setTeams(updateTeams(items), hasMore, cursor);
  },

  loadUserTeams(userTeams: Team[]) {
    store.setState({loadedUserTeams: true, teams: updateTeams(userTeams)});
  },

  onUpdateSuccess(itemId: string, response: Team) {
    if (!response) {
      return;
    }

    const {teams} = store.getState();
    const item = TeamStore.getBySlug(itemId);

    if (!item) {
      store.setState({teams: [...teams, response]});
      return;
    }

    // Slug was changed
    // Note: This is the proper way to handle slug changes but unfortunately not all of our
    // components use stores correctly. To be safe reload browser :((
    if (response.slug !== itemId) {
      // Replace the team
      store.setState({teams: [...teams.filter(({slug}) => slug !== itemId), response]});
      return;
    }

    const newTeams = [...teams];
    const index = newTeams.findIndex(team => team.slug === response.slug);
    newTeams[index] = response;

    store.setState({teams: newTeams});
  },

  onRemoveSuccess(slug: string) {
    TeamStore.setTeams(store.getState().teams.filter(team => team.slug !== slug));
    ProjectsStore.onDeleteTeam(slug);
  },

  onCreateSuccess(team: Team) {
    TeamStore.loadInitialData([team]);
  },

  getById(id: string) {
    return (
      store.getState().teams.find(item => item.id.toString() === id.toString()) || null
    );
  },

  getBySlug(slug: string) {
    return store.getState().teams.find(item => item.slug === slug) || null;
  },

  getAll() {
    return store.getState().teams;
  },
};
