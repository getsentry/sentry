import Reflux from 'reflux';

import ProjectActions from '../actions/projectActions';
import OrganizationsActions from '../actions/organizationsActions';

// Keeps track of last usable project/org
// this currently won't track when users navigate out of a org/project completely,
// it tracks only if a user switches into a new org/project
//
// Only keep slug so that people don't get the idea to access org/project data here
// Org/project data is currently in organizationsStore/projectsStore
const LatestContextStore = Reflux.createStore({
  getInitialState() {
    return this.state;
  },

  init() {
    this.reset();
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
  },

  reset() {
    this.state = {
      project: null,
      organization: null,
    };
    return this.state;
  },

  onSetActiveOrganization(org) {
    if (!org) return;

    // Update only if different
    if (this.state.organization !== org.slug) {
      this.state.organization = org.slug;
    }

    this.trigger(this.state);
  },

  onSetActiveProject(project) {
    if (!project) return;

    // Update only if different
    if (this.state.project !== project.slug) {
      this.state.project = project.slug;
    }

    this.trigger(this.state);
  },
});

export default LatestContextStore;
