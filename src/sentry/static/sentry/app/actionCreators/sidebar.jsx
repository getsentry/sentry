import Cookies from 'js-cookie';

import SidebarActions from '../actions/sidebarActions';

const SIDEBAR_COOKIE_KEY = 'sidebar_collapsed';

export function hideSidebar() {
  SidebarActions.hideSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, '1');
}

export function showSidebar() {
  SidebarActions.showSidebar();
  Cookies.set(SIDEBAR_COOKIE_KEY, '0');
}

export function loadSidebarState() {
  SidebarActions.loadInitialState(Cookies.get(SIDEBAR_COOKIE_KEY) === '1');
}
