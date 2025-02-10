import {t} from 'sentry/locale';
import {ModuleName} from 'sentry/views/insights/types';

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
  ModuleName.SESSIONS,
];
