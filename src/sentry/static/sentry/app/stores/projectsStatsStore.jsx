import Reflux from 'reflux';

import ProjectActions from 'app/actions/projectActions';

/**
 * This is a store specifically used by the dashboard, so that we can
 * clear the store when the Dashboard unmounts
 * (as to not disrupt ProjectsStore which a lot more components use)
 */
const ProjectsStatsStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(ProjectActions.loadStatsForProjectSuccess, this.onStatsLoadSuccess);
  },

  getInitialState() {
    return this.itemsById;
  },

  reset() {
    this.itemsById = {};
  },

  onStatsLoadSuccess(projects) {
    projects.forEach(project => {
      this.itemsById[project.id] = project;
    });
    this.trigger(this.itemsById);
  },
});

export default ProjectsStatsStore;
