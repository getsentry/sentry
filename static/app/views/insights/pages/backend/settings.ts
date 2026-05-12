import {backend} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';
import {ModuleName} from 'sentry/views/insights/types';

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

export const BACKEND_PLATFORMS: PlatformKey[] = [...backend];
