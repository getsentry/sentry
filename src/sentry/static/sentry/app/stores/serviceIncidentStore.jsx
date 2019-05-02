import Reflux from 'reflux';

import ServiceIncidentActions from 'app/actions/serviceIncidentActions';

const ServiceIncidentStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(ServiceIncidentActions.updateSuccess, this.onUpdateSuccess);
  },

  reset() {
    this.status = {};
  },

  onUpdateSuccess(data) {
    this.status = data.status;
    this.trigger(this.status);
  },

  getStatus() {
    return this.status;
  },
});

export default ServiceIncidentStore;
