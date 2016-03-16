import Reflux from 'reflux';
import AlertActions from '../actions/alertActions';

const AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init() {
    this.alerts = [];
    this.count = 0;
  },

  onAddAlert(message, type, expireAfter, url) {
    // intentionally recreate array via concat because of Reflux
    // "bug" where React components are given same reference to tracked
    // data objects, and don't *see* that values have changed
    let alertId = this.count++;

    this.alerts = this.alerts.concat([{
      id: alertId,
      message: message,
      type: type,
      url: url
    }]);

    if (typeof expireAfter === 'undefined') {
      expireAfter = 5000;
    }
    if (expireAfter) {
      window.setTimeout(() => {
        this.onCloseAlert(alertId);
      }, expireAfter);
    }

    this.trigger(this.alerts);
  },

  onCloseAlert(id) {
    // TODO(dcramer): we need some animations here for closing alerts
    this.alerts = this.alerts.filter(item => item.id !== id);
    this.trigger(this.alerts);
  },
});

export default AlertStore;
