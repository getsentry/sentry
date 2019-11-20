import Reflux from 'reflux';

import GlobalSelectionProjectActions from 'app/actions/globalSelectionProjectActions';

const GlobalSelectionProjectsStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(
      GlobalSelectionProjectActions.fetchSelectorProjects,
      this.onFetchSelectorProjects
    );
    this.listenTo(
      GlobalSelectionProjectActions.fetchSelectorProjectsError,
      this.onFetchSelectorProjectsError
    );
    this.listenTo(
      GlobalSelectionProjectActions.fetchSelectorProjectsSuccess,
      this.onFetchSelectorProjectsSuccess
    );
  },

  reset() {
    this.projects = [];
    this.error = null;
    this.initiallyLoaded = false;
    this.fetching = false;
    this.dirty = false;
    this.hasMore = false;
    this.trigger(this.get());
  },

  onFetchSelectorProjectsSuccess(projects, hasMore) {
    this.projects = [...this.projects, projects];
    this.initiallyLoaded = true;
    this.fetching = false;
    this.dirty = false;
    this.hasMore = hasMore;
    this.trigger(this.get());
  },

  onFetchSelectorProjects() {
    this.fetching = true;
    this.trigger(this.get());
  },

  onFetchSelectorProjectsError(err) {
    this.error = err;
    this.trigger(this.get());
  },

  onProjectOrTeamChange() {
    this.dirty = true;
  },

  get() {
    return {
      projects: this.projects,
      initiallyLoaded: this.initiallyLoaded,
      fetching: this.fetching,
      dirty: this.dirty,
      hasMore: this.hasMore,
    };
  },
});

export default GlobalSelectionProjectsStore;
