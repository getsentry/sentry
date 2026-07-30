import {t} from 'sentry/locale';

export const DASHBOARD_SAVING_MESSAGE = t('Saving changes\u2026');

export const NUM_DESKTOP_COLS = 6;

// Cache attribute-key results from the `/trace-items/attributes/` endpoint for
// the widget builder's field pickers. Attribute keys change rarely, so a longer
// stale time avoids re-fetching on every keystroke while searching.
export const WIDGET_BUILDER_ATTRIBUTE_STALE_TIME = 5 * 60 * 1000;

// Debounce applied to the widget builder field pickers' search input before it
// triggers a server-side attribute fetch.
export const WIDGET_BUILDER_ATTRIBUTE_SEARCH_DEBOUNCE_MS = 200;

export const WIDGET_BUILDER_ATTRIBUTE_LOADING_MESSAGE = t('Loading…');
