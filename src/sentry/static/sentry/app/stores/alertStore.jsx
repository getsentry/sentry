import Reflux from 'reflux';

import AlertActions from 'app/actions/alertActions';
import localStorage from 'app/utils/localStorage';
import {defined} from 'app/utils';

const AlertStore = Reflux.createStore({
  listenables: AlertActions,

  init() {
    this.alerts = [];
    this.count = 0;
  },

  onAddAlert(alert) {
    const alertAlreadyExists = this.alerts.some(a => a.id === alert.id);
    if (alertAlreadyExists && alert.noDuplicates) {
      return;
    }

    if (defined(alert.id)) {
      let expirations = localStorage.getItem('alerts:muted');
      if (defined(expirations)) {
        expirations = JSON.parse(expirations);

        // Remove any objects that have passed their mute duration.
        const now = Math.floor(new Date() / 1000);
        for (const key in expirations) {
          if (expirations.hasOwnProperty(key) && expirations[key] < now) {
            delete expirations[key];
          }
        }
        localStorage.setItem('alerts:muted', JSON.stringify(expirations));

        if (expirations.hasOwnProperty(alert.id)) {
          return;
        }
      }
    } else {
      if (!defined(alert.expireAfter)) {
        alert.expireAfter = 5000;
      }
    }

    if (alert.expireAfter && !alert.neverExpire) {
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
      const expiry = Math.floor(new Date() / 1000) + duration;
      let expirations = localStorage.getItem('alerts:muted');
      if (defined(expirations)) {
        expirations = JSON.parse(expirations);
      } else {
        expirations = {};
      }
      expirations[alert.id] = expiry;
      localStorage.setItem('alerts:muted', JSON.stringify(expirations));
    }

    // TODO(dcramer): we need some animations here for closing alerts
    this.alerts = this.alerts.filter(item => alert !== item);
    this.trigger(this.alerts);
  },
});

export default AlertStore;
