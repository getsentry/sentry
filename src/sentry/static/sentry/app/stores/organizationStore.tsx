import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import RequestError from 'app/utils/requestError/requestError';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';
import {Organization, Project, Team} from 'app/types';

type UpdateOptions = {
  replace?: boolean;
};

type OutputState = {
  organization: Organization | null;
  loading: boolean;
  dirty: boolean;
  errorType?: string | null;
  error?: RequestError | null;
};

type OrganizationStoreInterface = {
  init: () => void;
  reset: () => void;
  onUpdate: (org: Organization, options: UpdateOptions) => void;
  onFetchOrgError: (err: RequestError) => void;
  onProjectOrTeamChange: () => void;
  onLoadProjects: (projects: Project[]) => void;
  onLoadTeams: (teams: Team[]) => void;
  get: () => OutputState;
};

const storeConfig: Reflux.StoreDefinition & OrganizationStoreInterface = {
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    this.listenTo(OrganizationActions.fetchOrg, this.reset);
    this.listenTo(OrganizationActions.fetchOrgError, this.onFetchOrgError);

    // fill in teams and projects if they are loaded
    this.listenTo(ProjectActions.loadProjects, this.onLoadProjects);
    this.listenTo(TeamActions.loadTeams, this.onLoadTeams);

    // mark the store as dirty if projects or teams change
    this.listenTo(ProjectActions.createSuccess, this.onProjectOrTeamChange);
    this.listenTo(ProjectActions.updateSuccess, this.onProjectOrTeamChange);
    this.listenTo(ProjectActions.changeSlug, this.onProjectOrTeamChange);
    this.listenTo(ProjectActions.addTeamSuccess, this.onProjectOrTeamChange);
    this.listenTo(ProjectActions.removeTeamSuccess, this.onProjectOrTeamChange);

    this.listenTo(TeamActions.updateSuccess, this.onProjectOrTeamChange);
    this.listenTo(TeamActions.removeTeamSuccess, this.onProjectOrTeamChange);
    this.listenTo(TeamActions.createTeamSuccess, this.onProjectOrTeamChange);
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
    this.dirty = false;
    this.trigger(this.get());
  },

  onUpdate(updatedOrg: Organization, {replace = false}: UpdateOptions = {}) {
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = replace ? updatedOrg : {...this.organization, ...updatedOrg};
    this.dirty = false;
    this.trigger(this.get());
  },

  onFetchOrgError(err: RequestError) {
    this.organization = null;
    this.errorType = null;

    switch (err?.status) {
      case 404:
        this.errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;
      default:
    }
    this.loading = false;
    this.error = err;
    this.dirty = false;
    this.trigger(this.get());
  },

  onProjectOrTeamChange() {
    // mark the store as dirty so the next fetch will trigger an org details refetch
    this.dirty = true;
  },

  onLoadProjects(projects: Project[]) {
    if (this.organization) {
      // sort projects to mimic how they are received from backend
      projects.sort((a, b) => a.slug.localeCompare(b.slug));
      this.organization = {...this.organization, projects};
      this.trigger(this.get());
    }
  },

  onLoadTeams(teams: Team[]) {
    if (this.organization) {
      // sort teams to mimic how they are received from backend
      teams.sort((a, b) => a.slug.localeCompare(b.slug));
      this.organization = {...this.organization, teams};
      this.trigger(this.get());
    }
  },

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
      dirty: this.dirty,
    };
  },
};

type OrganizationStore = Reflux.Store & OrganizationStoreInterface;

export default Reflux.createStore(storeConfig) as OrganizationStore;
