import Reflux from 'reflux';

import {Team} from 'app/types';
import TeamActions from 'app/actions/teamActions';

type TeamStoreInterface = {
  initialized: boolean;
  state: Team[];
  reset: () => void;
  loadInitialData: (items: Team[]) => void;
  onUpdateSuccess: (itemId: string, response: Team) => void;
  onRemoveSuccess: (slug: string) => void;
  onCreateSuccess: (team: Team) => void;
  getById: (id: string) => Team | null;
  getBySlug: (slug: string) => Team | null;
  getActive: () => Team[];
  getAll: () => Team[];
};

const teamStoreConfig: Reflux.StoreDefinition & TeamStoreInterface = {
  initialized: false,
  state: [],

  init() {
    this.state = [];

    this.listenTo(TeamActions.createTeamSuccess, this.onCreateSuccess);
    this.listenTo(TeamActions.fetchDetailsSuccess, this.onUpdateSuccess);
    this.listenTo(TeamActions.loadTeams, this.loadInitialData);
    this.listenTo(TeamActions.removeTeamSuccess, this.onRemoveSuccess);
    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.state = [];
  },

  loadInitialData(items) {
    this.initialized = true;
    this.state = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  onUpdateSuccess(itemId, response) {
    if (!response) {
      return;
    }

    const item = this.getBySlug(itemId);

    if (!item) {
      this.state.push(response);
      this.trigger(new Set([itemId]));
      return;
    }

    // Slug was changed
    // Note: This is the proper way to handle slug changes but unfortunately not all of our
    // components use stores correctly. To be safe reload browser :((
    if (response.slug !== itemId) {
      // Remove old team
      this.state = this.state.filter(({slug}) => slug !== itemId);

      // Add team w/ updated slug
      this.state.push(response);
      this.trigger(new Set([response.slug]));
      return;
    }

    const nextState = [...this.state];
    const index = nextState.findIndex(team => team.slug === response.slug);
    nextState[index] = response;
    this.state = nextState;

    this.trigger(new Set([itemId]));
  },

  onRemoveSuccess(slug: string) {
    this.loadInitialData(this.state.filter(team => team.slug !== slug));
  },

  onCreateSuccess(team: Team) {
    this.loadInitialData([...this.state, team]);
  },

  getById(id: string) {
    return this.state.find(item => item.id.toString() === id.toString()) || null;
  },

  getBySlug(slug: string) {
    return this.state.find(item => item.slug === slug) || null;
  },

  getActive() {
    return this.state.filter(item => item.isMember);
  },

  getAll() {
    return this.state;
  },
};

type TeamStore = Reflux.Store & TeamStoreInterface;

export default Reflux.createStore(teamStoreConfig) as TeamStore;
