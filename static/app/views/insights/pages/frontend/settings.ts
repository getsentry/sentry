import {frontend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import type {ValidSort} from 'sentry/views/insights/pages/frontend/frontendOverviewTable';
import {type EAPSpanProperty, ModuleName} from 'sentry/views/insights/types';

export const FRONTEND_LANDING_SUB_PATH = 'frontend';
export const FRONTEND_LANDING_TITLE = t('Frontend');
export const FRONTEND_SIDEBAR_LABEL = t('Frontend');

export const EAP_OVERVIEW_PAGE_ALLOWED_OPS = [
  'ui.render',
  'interaction',
  'ui.interaction',
  'ui.interaction.click',
  'ui.interaction.hover',
  'ui.interaction.drag',
  'ui.interaction.press',
  'ui.webvital.cls',
  'ui.webvital.fcp',
];

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'pageload',
  'navigation',
  'ui.render',
  'interaction',
];

export const MODULES = [
  ModuleName.VITAL,
  ModuleName.HTTP,
  ModuleName.RESOURCE,
  ModuleName.SESSIONS,
];

// Mirrors `FRONTEND` in src/sentry/utils/platform_categories.py, except shared platforms are removed
export const FRONTEND_PLATFORMS: PlatformKey[] = frontend.filter(
  platform =>
    // Next, Remix and Sveltekit have both, frontend and backend transactions.
    !['javascript-nextjs', 'javascript-remix', 'javascript-sveltekit'].includes(platform)
);

export const DEFAULT_SORT: ValidSort = {
  field: 'sum_if(span.duration,is_transaction,true)' satisfies EAPSpanProperty,
  kind: 'desc',
};

export const PAGE_SPAN_OPS = ['all', 'pageload', 'navigation'] as const;
export type PageSpanOps = (typeof PAGE_SPAN_OPS)[number];
export const DEFAULT_SPAN_OP_SELECTION: PageSpanOps = 'all';
export const SPAN_OP_QUERY_PARAM = 'span.op';
