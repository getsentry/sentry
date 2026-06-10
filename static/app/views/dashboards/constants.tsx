import {t} from 'sentry/locale';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {WidgetType} from 'sentry/views/dashboards/types';

export const DASHBOARD_SAVING_MESSAGE = t('Saving changes\u2026');

export const NUM_DESKTOP_COLS = 6;

// Max widgets per dashboard we are currently willing
// to allow to limit the load on snuba from the
// parallel requests. Somewhat arbitrary
// limit that can be changed if necessary.
export const MAX_WIDGETS = 30;

export const DEFAULT_TABLE_LIMIT = 5;
export const MAX_TABLE_LIMIT = 10;

export const DEFAULT_CATEGORICAL_BAR_LIMIT = 20;
export const MAX_CATEGORICAL_BAR_LIMIT = 25;

export const DEFAULT_WIDGET_NAME = t('Custom Widget');
export const PREBUILT_DASHBOARD_LABEL = t('Sentry Built');

export const WIDGET_TYPE_TO_SAVED_QUERY_DATASET = {
  [WidgetType.ERRORS]: SavedQueryDatasets.ERRORS,
  [WidgetType.TRANSACTIONS]: SavedQueryDatasets.TRANSACTIONS,
};
