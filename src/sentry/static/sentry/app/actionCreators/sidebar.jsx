import Cookies from 'js-cookie';

import SidebarActions from '../actions/sidebarActions';

const SIDEBAR_COOKIE_KEY = 'sidebar_collapsed';
const SIDEBAR_COOKIE_ENABLED = '1';
const SIDEBAR_COOKIE_DISABLED = '0';

export function hideSidebar() {
  SidebarActions.hideSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, SIDEBAR_COOKIE_ENABLED);
}

export function showSidebar() {
  SidebarActions.showSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, SIDEBAR_COOKIE_DISABLED);
}

export function loadSidebarState() {
  // Set initial "collapsed" state to true or false
  SidebarActions.loadInitialState(
    Cookies.get(SIDEBAR_COOKIE_KEY) === SIDEBAR_COOKIE_ENABLED
  );
}
