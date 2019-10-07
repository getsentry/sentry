import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import OrganizationsActions from 'app/actions/organizationsActions';

const OrganizationStore = Reflux.createStore({
  listenables: OrganizationActions,

  init() {
    this.reset();

    // also listen to updates from OrganizationsActions triggered from settings
    this.listenTo(OrganizationsActions.update, this.onUpdate);
  },

  reset() {
    this.org = {};
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
