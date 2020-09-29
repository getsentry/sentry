import Reflux from 'reflux';

import ProjectActions from 'app/actions/projectActions';
import OrganizationActions from 'app/actions/organizationActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import NavigationActions from 'app/actions/navigationActions';
import {LightWeightOrganization, Organization, Project} from 'app/types';

type OrgTypes = LightWeightOrganization | Organization | null;

type State = {
  project: Project | null;
  lastProject: Project | null;
  organization: OrgTypes;
  environment: string | string[] | null;
  lastRoute: string | null;
};

type LatestContextStoreInterface = {
  state: State;
  reset: () => void;
  onSetLastRoute: (route: string) => void;
  onUpdateOrganization: (organization: OrgTypes) => void;
  onSetActiveOrganization: (organization: OrgTypes) => void;
  onSetActiveProject: (project: Project | null) => void;
  onUpdateProject: (project: Project | null) => void;
};

// Keeps track of last usable project/org
// this currently won't track when users navigate out of a org/project completely,
// it tracks only if a user switches into a new org/project
//
// Only keep slug so that people don't get the idea to access org/project data here
// Org/project data is currently in organizationsStore/projectsStore
const storeConfig: Reflux.StoreDefinition & LatestContextStoreInterface = {
  state: {
    project: null,
    lastProject: null,
    organization: null,
    environment: null,
    lastRoute: null,
  },

  getInitialState() {
    return this.state;
  },

  init() {
    this.reset();
    this.listenTo(ProjectActions.setActive, this.onSetActiveProject);
    this.listenTo(ProjectActions.updateSuccess, this.onUpdateProject);
    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
    this.listenTo(OrganizationsActions.update, this.onUpdateOrganization);
    this.listenTo(OrganizationActions.update, this.onUpdateOrganization);
    this.listenTo(NavigationActions.setLastRoute, this.onSetLastRoute);
  },

  reset() {
    this.state = {
      project: null,
      lastProject: null,
      organization: null,
      environment: null,
      lastRoute: null,
    };
    return this.state;
  },

  onSetLastRoute(route) {
    this.state = {
      ...this.state,
      lastRoute: route,
    };

    this.trigger(this.state);
  },

  onUpdateOrganization(org) {
    // Don't do anything if base/target orgs are falsey
    if (!this.state.organization) {
      return;
    }
    if (!org) {
      return;
    }
    // Check to make sure current active org is what has been updated
    if (org.slug !== this.state.organization.slug) {
      return;
    }

    this.state = {
      ...this.state,
      organization: org,
    };
    this.trigger(this.state);
  },

  onSetActiveOrganization(org) {
    if (!org) {
      this.state = {
        ...this.state,
        organization: null,
        project: null,
      };
    } else if (!this.state.organization || this.state.organization.slug !== org.slug) {
      // Update only if different
      this.state = {
        ...this.state,
        organization: org,
        project: null,
      };
    }

    this.trigger(this.state);
  },

  onSetActiveProject(project) {
    if (!project) {
      this.state = {
        ...this.state,
        lastProject: this.state.project,
        project: null,
      };
    } else if (!this.state.project || this.state.project.slug !== project.slug) {
      // Update only if different
      this.state = {
        ...this.state,
        lastProject: this.state.project,
        project,
      };
    }

    this.trigger(this.state);
  },

  onUpdateProject(project) {
    this.state = {
      ...this.state,
      project,
    };
    this.trigger(this.state);
  },
};

type LatestContextStore = Reflux.Store & LatestContextStoreInterface;

export default Reflux.createStore(storeConfig) as LatestContextStore;
