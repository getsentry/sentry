import Cookies from 'js-cookie';

import PreferencesActions from '../actions/preferencesActions';

const SIDEBAR_COOKIE_KEY = 'sidebar_collapsed';
const DASHBOARD_KEY = 'dashboard_type';
const COOKIE_ENABLED = '1';
const COOKIE_DISABLED = '0';

export function hideSidebar() {
  PreferencesActions.hideSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, COOKIE_ENABLED);
}

export function showSidebar() {
  PreferencesActions.showSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, COOKIE_DISABLED);
}

export function loadPreferencesState() {
  // Set initial "collapsed" state to true or false
  PreferencesActions.loadInitialState({
    collapsed: Cookies.get(SIDEBAR_COOKIE_KEY) === COOKIE_ENABLED,
    dashboardType: Cookies.get(DASHBOARD_KEY),
  });
}

export function changeDashboard(type) {
  PreferencesActions.changeDashboard(type);
  Cookies.set(DASHBOARD_KEY, type);
}
