import Reflux from 'reflux';
import AlertActions from '../actions/alertActions';
import {getItem, setItem} from '../utils/localStorage';
import {defined} from '../utils';

const AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init() {
    this.alerts = [];
    this.count = 0;
  },

  onAddAlert(alert) {
    if (defined(alert.id)) {
      let expirations = getItem('alerts:muted');
      if (defined(expirations)) {
        expirations = JSON.parse(expirations);

        // Remove any objects that have passed their mute duration.
        let now = Math.floor(new Date() / 1000);
        for (let key in expirations) {
          if (expirations.hasOwnProperty(key) && expirations[key] < now) {
            delete expirations[key];
          }
        }
        setItem('alerts:muted', JSON.stringify(expirations));

        if (expirations.hasOwnProperty(alert.id)) {
          return;
        }
      }
    } else {
      if (defined(alert.expireAfter)) {
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

  onCloseAlert(alert, duration = 60 * 60 * 7 * 24) {
    if (defined(alert.id) && defined(duration)) {
      let expiry = Math.floor(new Date() / 1000) + duration;
      let expirations = getItem('alerts:muted');
      if (defined(expirations)) {
        expirations = JSON.parse(expirations);
      } else {
        expirations = {};
      }
      expirations[alert.id] = expiry;
      setItem('alerts:muted', JSON.stringify(expirations));
    }

    // TODO(dcramer): we need some animations here for closing alerts
    this.alerts = this.alerts.filter(item => alert !== item);
    this.trigger(this.alerts);
  },
});

export default AlertStore;
