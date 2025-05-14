import {mobile} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import type {ValidSort} from 'sentry/views/insights/pages/mobile/mobileOverviewTable';
import type {EAPSpanProperty} from 'sentry/views/insights/types';
import {ModuleName} from 'sentry/views/insights/types';

export const MOBILE_LANDING_SUB_PATH = 'mobile';
export const MOBILE_LANDING_TITLE = t('Mobile');
export const MOBILE_SIDEBAR_LABEL = t('Mobile');

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'ui.action.swipe',
  'ui.action.scroll',
  'ui.action.click',
  'ui.action',
  'ui.load',
  'app.lifecycle',
];

export const MODULES = [ModuleName.MOBILE_VITALS, ModuleName.HTTP, ModuleName.SESSIONS];

// Mirrors `FRONTEND` in src/sentry/utils/platform_categories.py, except shared platforms are removed
export const MOBILE_PLATFORMS: PlatformKey[] = [...mobile];

export const DEFAULT_SORT: ValidSort = {
  field: 'sum(span.duration)' satisfies EAPSpanProperty,
  kind: 'desc',
};
