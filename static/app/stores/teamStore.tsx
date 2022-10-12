import {createStore} from 'reflux';

import {Team} from 'sentry/types';
import {defined} from 'sentry/utils';

import ProjectsStore from './projectsStore';
import {CommonStoreDefinition} from './types';

type State = {
  cursor: string | null;
  hasMore: boolean | null;
  loadedUserTeams: boolean;
  loading: boolean;
  teams: Team[];
};

interface TeamStoreDefinition extends CommonStoreDefinition<State> {
  getAll(): Team[];
  getById(id: string): Team | null;
  getBySlug(slug: string): Team | null;
  init(): void;
  initialized: boolean;
  loadInitialData(items: Team[], hasMore?: boolean | null, cursor?: string | null): void;
  loadUserTeams(userTeams: Team[]): void;
  onCreateSuccess(team: Team): void;
  onRemoveSuccess(slug: string): void;
  onUpdateSuccess(itemId: string, response: Team): void;
  reset(): void;

  state: State;
}

const teamStoreConfig: TeamStoreDefinition = {
  initialized: false,
  state: {
    teams: [],
    loadedUserTeams: false,
    loading: true,
    hasMore: null,
    cursor: null,
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      teams: [],
      loadedUserTeams: false,
      loading: true,
      hasMore: null,
      cursor: null,
    };
  },

  setTeams(teams, hasMore, cursor) {
    this.initialized = true;
    this.state = {
      teams,
      loadedUserTeams: defined(hasMore) ? !hasMore : this.state.loadedUserTeams,
      loading: false,
      hasMore: hasMore ?? this.state.hasMore,
      cursor: cursor ?? this.state.cursor,
    };
    this.trigger(new Set(teams.map(team => team.id)));
  },

  loadInitialData(items, hasMore, cursor) {
    const teams = this.updateTeams(items);
    this.setTeams(teams, hasMore, cursor);
  },

  loadUserTeams(userTeams: Team[]) {
    const teams = this.updateTeams(userTeams);

    this.state = {
      ...this.state,
      loadedUserTeams: true,
      teams,
    };

    this.trigger(new Set(teams.map(team => team.id)));
  },

  onUpdateSuccess(itemId, response) {
    if (!response) {
      return;
    }

    const item = this.getBySlug(itemId);

    if (!item) {
      this.state = {
        ...this.state,
        teams: [...this.state.teams, response],
      };

      this.trigger(new Set([itemId]));
      return;
    }

    // Slug was changed
    // Note: This is the proper way to handle slug changes but unfortunately not all of our
    // components use stores correctly. To be safe reload browser :((
    if (response.slug !== itemId) {
      // Replace the team
      const teams = [...this.state.teams.filter(({slug}) => slug !== itemId), response];

      this.state = {...this.state, teams};
      this.trigger(new Set([response.slug]));
      return;
    }

    const newTeams = [...this.state.teams];
    const index = newTeams.findIndex(team => team.slug === response.slug);
    newTeams[index] = response;

    this.state = {...this.state, teams: newTeams};
    this.trigger(new Set([itemId]));
  },

  onRemoveSuccess(slug: string) {
    const teams = this.state.teams.filter(team => team.slug !== slug);
    this.setTeams(teams);
    ProjectsStore.onDeleteTeam(slug);
  },

  onCreateSuccess(team: Team) {
    this.loadInitialData([team]);
  },

  getState() {
    return this.state;
  },

  getById(id: string) {
    const {teams} = this.state;
    return teams.find(item => item.id.toString() === id.toString()) || null;
  },

  getBySlug(slug: string) {
    const {teams} = this.state;
    return teams.find(item => item.slug === slug) || null;
  },

  getAll() {
    return this.state.teams;
  },

  updateTeams(teams: Team[]) {
    const teamIdMap = this.state.teams.reduce((acc: Record<string, Team>, team: Team) => {
      acc[team.id] = team;
      return acc;
    }, {});

    // Replace or insert new user teams
    teams.reduce((acc: Record<string, Team>, userTeam: Team) => {
      acc[userTeam.id] = userTeam;
      return acc;
    }, teamIdMap);

    return Object.values(teamIdMap).sort((a, b) => a.slug.localeCompare(b.slug));
  },
};

const TeamStore = createStore(teamStoreConfig);
export default TeamStore;
