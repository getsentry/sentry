import {t} from 'sentry/locale';
import type {ValidSort} from 'sentry/views/insights/pages/backend/backendTable';
import {type EAPSpanProperty, ModuleName} from 'sentry/views/insights/types';

export const BACKEND_LANDING_SUB_PATH = 'backend';
export const BACKEND_LANDING_TITLE = t('Backend');
export const BACKEND_SIDEBAR_LABEL = t('Backend');

export const MODULES = [
  ModuleName.DB,
  ModuleName.HTTP,
  ModuleName.CACHE,
  ModuleName.QUEUE,
  ModuleName.CRONS,
  ModuleName.UPTIME,
];

export const OVERVIEW_PAGE_ALLOWED_OPS = ['http.server'];

export const DEFAULT_SORT: ValidSort = {
  field: 'time_spent_percentage(span.duration)' satisfies EAPSpanProperty,
  kind: 'desc',
};
