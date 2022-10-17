import {createStore, StoreDefinition} from 'reflux';

import {Organization, Project} from 'sentry/types';

type State = {
  environment: string | string[] | null;
  lastProject: Project | null;
  organization: Organization | null;
  project: Project | null;
};

interface LatestContextStoreDefinition extends StoreDefinition {
  get(): State;
  onSetActiveOrganization(organization: Organization): void;
  onSetActiveProject(project: Project | null): void;
  onUpdateOrganization(organization: Partial<Organization>): void;
  onUpdateProject(project: Project | null): void;
  reset(): void;
  state: State;
}

/**
 * Keeps track of last usable project/org this currently won't track when users
 * navigate out of a org/project completely, it tracks only if a user switches
 * into a new org/project.
 *
 * Only keep slug so that people don't get the idea to access org/project data
 * here Org/project data is currently in organizationsStore/projectsStore
 */
const storeConfig: LatestContextStoreDefinition = {
  state: {
    project: null,
    lastProject: null,
    organization: null,
    environment: null,
  },

  get() {
    return this.state;
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      project: null,
      lastProject: null,
      organization: null,
      environment: null,
    };
    return this.state;
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
      organization: {...this.state.organization, ...org},
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

const LatestContextStore = createStore(storeConfig);
export default LatestContextStore;
