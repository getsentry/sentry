import Reflux from 'reflux';

import GlobalSelectionActions from 'app/actions/globalSelectionActions';

/**
 * Store for global selections
 * Currently stores active project ids for Discover and EventStream
 */
const GlobalSelectionStore = Reflux.createStore({
  init() {
    this.selection = {
      projects: [],
    };
    this.listenTo(GlobalSelectionActions.updateProjects, this.updateProjects);
  },

  get() {
    return this.selection;
  },

  updateProjects(projects = []) {
    this.selection.projects = projects;
    this.trigger(this.selection);
  },
});

export default GlobalSelectionStore;
