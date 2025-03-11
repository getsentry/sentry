import {frontend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import {ModuleName} from 'sentry/views/insights/types';

export const FRONTEND_LANDING_SUB_PATH = 'frontend';
export const FRONTEND_LANDING_TITLE = t('Frontend');
export const FRONTEND_SIDEBAR_LABEL = t('Frontend');

export const OVERVIEW_PAGE_ALLOWED_OPS = [
  'pageload',
  'navigation',
  'ui.render',
  'interaction',
];

export const OVERVIEW_PAGE_DISALLOWED_OPS = ['http.server'];

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
