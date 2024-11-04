import {space} from 'sentry/styles/space';
import localStorage from 'sentry/utils/localStorage';

// TODO(nikkikapadia): delete this file and move contents to index.tsx
export const SHOW_TEMPLATES_KEY = 'dashboards-show-templates';

export const MINIMUM_DASHBOARD_CARD_WIDTH = 300;
export const DASHBOARD_CARD_GRID_PADDING = Number(space(2).replace('px', ''));
export const DASHBOARD_GRID_DEFAULT_NUM_ROWS = 3;
export const DASHBOARD_GRID_DEFAULT_NUM_COLUMNS = 3;
export const DASHBOARD_GRID_DEFAULT_NUM_CARDS = 8;

export function shouldShowTemplates(): boolean {
  const shouldShow = localStorage.getItem(SHOW_TEMPLATES_KEY);
  return shouldShow === 'true' || shouldShow === null;
}
export function setShowTemplates(value: boolean) {
  localStorage.setItem(SHOW_TEMPLATES_KEY, value ? 'true' : 'false');
}
