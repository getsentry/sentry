import {createStore} from 'reflux';

import {defined} from 'sentry/utils';
import localStorage from 'sentry/utils/localStorage';
import {Theme} from 'sentry/utils/theme';

import {CommonStoreDefinition} from './types';

type Alert = {
  message: React.ReactNode;
  type: keyof Theme['alert'];
  expireAfter?: number;
  id?: string;
  key?: number;
  neverExpire?: boolean;
  noDuplicates?: boolean;
  onClose?: () => void;
  opaque?: boolean;
  url?: string;
};

interface InternalAlertStoreDefinition {
  alerts: Alert[];
  count: number;
}
interface AlertStoreDefinition
  extends CommonStoreDefinition<Alert[]>,
    InternalAlertStoreDefinition {
  addAlert(alert: Alert): void;
  closeAlert(alert: Alert, duration?: number): void;
  init(): void;
}

const storeConfig: AlertStoreDefinition = {
  alerts: [],
  count: 0,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.alerts = [];
    this.count = 0;
  },

  addAlert(alert) {
    const alertAlreadyExists = this.alerts.some(a => a.id === alert.id);
    if (alertAlreadyExists && alert.noDuplicates) {
      return;
    }

    if (defined(alert.id)) {
      const mutedData = localStorage.getItem('alerts:muted');
      if (typeof mutedData === 'string' && mutedData.length) {
        const expirations: Record<string, number> = JSON.parse(mutedData);

        // Remove any objects that have passed their mute duration.
        const now = Math.floor(new Date().valueOf() / 1000);
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
        this.closeAlert(alert);
      }, alert.expireAfter);
    }

    alert.key = this.count++;

    // intentionally recreate array via concat because of Reflux
    // "bug" where React components are given same reference to tracked
    // data objects, and don't *see* that values have changed
    this.alerts = this.alerts.concat([alert]);
    this.trigger(this.alerts);
  },

  closeAlert(alert, duration = 60 * 60 * 7 * 24) {
    if (defined(alert.id) && defined(duration)) {
      const expiry = Math.floor(new Date().valueOf() / 1000) + duration;
      const mutedData = localStorage.getItem('alerts:muted');

      let expirations: Record<string, number> = {};
      if (typeof mutedData === 'string' && expirations.length) {
        expirations = JSON.parse(mutedData);
      }
      expirations[alert.id] = expiry;
      localStorage.setItem('alerts:muted', JSON.stringify(expirations));
    }

    // TODO(dcramer): we need some animations here for closing alerts
    this.alerts = this.alerts.filter(item => alert !== item);
    this.trigger(this.alerts);
  },

  getState() {
    return this.alerts;
  },
};

const AlertStore = createStore(storeConfig);
export default AlertStore;
