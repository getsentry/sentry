import {backend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import type {ValidSort} from 'sentry/views/insights/pages/backend/backendTable';
import {ModuleName, type SpanProperty} from 'sentry/views/insights/types';

export const BACKEND_LANDING_SUB_PATH = 'backend';
export const BACKEND_LANDING_TITLE = t('Backend');
export const BACKEND_SIDEBAR_LABEL = t('Backend');

export const MODULES = [
  ModuleName.DB,
  ModuleName.HTTP,
  ModuleName.CACHE,
  ModuleName.QUEUE,
];

export const OVERVIEW_PAGE_ALLOWED_OPS = ['http.server'];

export const DEFAULT_SORT: ValidSort = {
  field: 'sum(span.duration)' satisfies SpanProperty,
  kind: 'desc',
};

export const BACKEND_PLATFORMS: PlatformKey[] = [...backend];
