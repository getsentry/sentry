import Reflux from 'reflux';
import AlertActions from '../actions/alertActions';
import {getItem, setItem} from '../utils/localStorage';

const AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init() {
    this.alerts = [];
    this.count = 0;
  },

  getMutedKey(alert) {
    return `alerts:${alert.id}:muted`;
  },

  onAddAlert(alert) {
    if (alert.id !== void 0) {
      if (getItem(this.getMutedKey(alert)) !== null) {
        return;
      }
    } else {
      if (alert.expireAfter === void 0) {
        alert.expireAfter = 5000;
      }
    }

    if (alert.expireAfter) {
      window.setTimeout(() => {
        this.onCloseAlert(alert);
      }, alert.expireAfter);
    }

    alert.key = this.count++;

    // intentionally recreate array via concat because of Reflux
    // "bug" where React components are given same reference to tracked
    // data objects, and don't *see* that values have changed
    this.alerts = this.alerts.concat([alert]);
    this.trigger(this.alerts);
  },

  onCloseAlert(alert) {
    if (alert.id !== void 0) {
      setItem(this.getMutedKey(alert), +new Date());
    }

    // TODO(dcramer): we need some animations here for closing alerts
    this.alerts = this.alerts.filter(item => alert !== item);
    this.trigger(this.alerts);
  },
});

export default AlertStore;
