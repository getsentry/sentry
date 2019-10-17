import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';

const OrganizationStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    this.listenTo(OrganizationActions.fetchOrg, this.reset);
    this.listenTo(OrganizationActions.fetchOrgError, this.onFetchOrgError);

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

  onUpdate(updatedOrg) {
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = {...this.organization, ...updatedOrg};
    this.dirty = false;
    this.trigger(this.get());
  },

  onFetchOrgError(err) {
    this.organization = null;
    this.errorType = null;

    switch (err.statusText) {
      case 'NOT FOUND':
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

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
      dirty: this.dirty,
    };
  },
});

export default OrganizationStore;
