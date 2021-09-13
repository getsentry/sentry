import Reflux from 'reflux';

import TeamActions from 'app/actions/teamActions';
import {Team} from 'app/types';

type State = {
  teams: Team[];
  loading: boolean;
  hasMore: boolean | null;
};

type TeamStoreInterface = {
  initialized: boolean;
  state: State;
  reset: () => void;
  loadInitialData: (items: Team[], hasMore?: boolean | null) => void;
  onUpdateSuccess: (itemId: string, response: Team) => void;
  onRemoveSuccess: (slug: string) => void;
  onCreateSuccess: (team: Team) => void;
  get: () => State;
  getAll: () => Team[];
  getById: (id: string) => Team | null;
  getBySlug: (slug: string) => Team | null;
};

const teamStoreConfig: Reflux.StoreDefinition & TeamStoreInterface = {
  initialized: false,
  state: {
    teams: [],
    loading: true,
    hasMore: null,
  },

  init() {
    this.reset();

    this.listenTo(TeamActions.createTeamSuccess, this.onCreateSuccess);
    this.listenTo(TeamActions.fetchDetailsSuccess, this.onUpdateSuccess);
    this.listenTo(TeamActions.loadTeams, this.loadInitialData);
    this.listenTo(TeamActions.removeTeamSuccess, this.onRemoveSuccess);
    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.state = {teams: [], loading: true, hasMore: null};
  },

  loadInitialData(items, hasMore = null) {
    this.initialized = true;
    this.state = {
      teams: items.sort((a, b) => a.slug.localeCompare(b.slug)),
      loading: false,
      hasMore,
    };
    this.trigger(new Set(items.map(item => item.id)));
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
      // Remove old team
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
    const {teams} = this.state;
    this.loadInitialData(teams.filter(team => team.slug !== slug));
  },

  onCreateSuccess(team: Team) {
    this.loadInitialData([...this.state.teams, team]);
  },

  get() {
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
};

type TeamStore = Reflux.Store & TeamStoreInterface;

const TeamStore = Reflux.createStore(teamStoreConfig) as TeamStore;

export default TeamStore;
