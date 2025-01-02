import type {Theme} from '@emotion/react';
import {createStore} from 'reflux';

import {defined} from 'sentry/utils';
import localStorage from 'sentry/utils/localStorage';

import type {StrictStoreDefinition} from './types';

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
  count: number;
}
interface AlertStoreDefinition
  extends StrictStoreDefinition<Alert[]>,
    InternalAlertStoreDefinition {
  addAlert(alert: Alert): void;
  closeAlert(alert: Alert, duration?: number): void;
}

const storeConfig: AlertStoreDefinition = {
  state: [],
  count: 0,

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = [];
    this.count = 0;
  },

  addAlert(alert) {
    const alertAlreadyExists = this.state.some(a => a.id === alert.id);
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
          if (expirations.hasOwnProperty(key) && expirations[key]! < now) {
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
    this.state = this.state.concat([alert]);
    this.trigger(this.state);
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
    this.state = this.state.filter(item => alert !== item);
    this.trigger(this.state);
  },

  getState() {
    return this.state;
  },
};

const AlertStore = createStore(storeConfig);
export default AlertStore;
