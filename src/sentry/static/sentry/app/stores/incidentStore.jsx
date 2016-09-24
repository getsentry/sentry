import Reflux from 'reflux';

import IncidentActions from '../actions/incidentActions';

const IncidentStore = Reflux.createStore({
  init() {
    this.reset();

    this.listenTo(IncidentActions.updateSuccess, this.onUpdateSuccess);
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

export default IncidentStore;

