import {t} from 'sentry/locale';
import type {ModuleName} from 'sentry/views/insights/types';

import {MODULES as AGENTS_MODULES} from './agents/settings';
import {MODULES as BACKEND_MODULES} from './backend/settings';
import {MODULES as FRONTEND_MODULES} from './frontend/settings';
import {MODULES as MCP_MODULES} from './mcp/settings';
import {MODULES as MOBILE_MODULES} from './mobile/settings';
import type {DomainView} from './useFilters';

export const OVERVIEW_PAGE_TITLE = t('Overview');
export const DOMAIN_VIEW_BASE_URL = 'insights';
export const DOMAIN_VIEW_BASE_TITLE = t('Insights');

export const DOMAIN_VIEW_MODULES: Record<DomainView, ModuleName[]> = {
  frontend: FRONTEND_MODULES,
  backend: BACKEND_MODULES,
  'ai-agents': AGENTS_MODULES,
  mobile: MOBILE_MODULES,
  mcp: MCP_MODULES,
};
