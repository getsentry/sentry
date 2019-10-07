import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import OrganizationsActions from 'app/actions/organizationsActions';

const OrganizationStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    // also listen to updates from OrganizationsActions triggered from settings
    this.listenTo(OrganizationsActions.update, this.onUpdate);
  },

  reset() {
    this.org = null;
  },

  onUpdate(updatedOrg) {
    this.org = {...this.org, ...updatedOrg};
    this.trigger(this.org);
  },

  getOrganization() {
    return this.org;
  },
});

export default OrganizationStore;
