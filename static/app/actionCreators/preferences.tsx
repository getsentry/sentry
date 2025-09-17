import Cookies from 'js-cookie';

import PreferenceStore from 'sentry/stores/preferencesStore';

const SIDEBAR_COOKIE_KEY = 'sidebar_collapsed';
const COOKIE_ENABLED = '1';

export function loadPreferencesState() {
  // Set initial "collapsed" state to true or false
  PreferenceStore.loadInitialState({
    collapsed: Cookies.get(SIDEBAR_COOKIE_KEY) === COOKIE_ENABLED,
  });
}
