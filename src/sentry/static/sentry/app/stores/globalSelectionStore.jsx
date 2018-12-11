import Reflux from 'reflux';

import {DEFAULT_STATS_PERIOD} from 'app/constants';

import GlobalSelectionActions from 'app/actions/globalSelectionActions';

/**
 * Store for global selections
 * Currently stores active project ids for Discover and EventStream
 */
const GlobalSelectionStore = Reflux.createStore({
  init() {
    this.selection = {
      projects: [],
      environments: [],
      datetime: {start: null, end: null, range: DEFAULT_STATS_PERIOD},
    };
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
    this.listenTo(GlobalSelectionActions.updateDateTime, this.updateDateTime);
    this.listenTo(GlobalSelectionActions.updateEnvironments, this.updateEnvironments);
  },

  get() {
    return this.selection;
  },

  updateProjects(projects = []) {
    this.selection.projects = projects;
    this.trigger(this.selection);
  },

  updateDateTime(datetime) {
    this.selection.datetime = datetime;
    this.trigger(this.selection);
  },

  updateEnvironments(environments = []) {
    this.selection.environments = environments;
    this.trigger(this.selection);
  },
});

export default GlobalSelectionStore;
