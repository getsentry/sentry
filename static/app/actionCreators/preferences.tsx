import Cookies from 'js-cookie';

import PreferenceStore from 'sentry/stores/preferencesStore';

const SIDEBAR_COOKIE_KEY = 'sidebar_collapsed';
const COOKIE_ENABLED = '1';
const COOKIE_DISABLED = '0';

export function hideSidebar() {
  PreferenceStore.hideSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, COOKIE_ENABLED);
}

export function showSidebar() {
  PreferenceStore.showSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, COOKIE_DISABLED);
}

export function loadPreferencesState() {
  // Set initial "collapsed" state to true or false
  PreferenceStore.loadInitialState({
    collapsed: Cookies.get(SIDEBAR_COOKIE_KEY) === COOKIE_ENABLED,
  });
}
