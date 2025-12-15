import {
  FRONTEND_MODULE_TITLE as HTTP_FRONTEND_MODULE_TITLE,
  MOBILE_MODULE_TITLE as HTTP_MOBILE_MODULE_TITLE,
} from 'sentry/views/insights/http/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

/**
 * These are overrides for the module titles for each domain view,
 * If a module is not listed here, it will use the default module title from MODULE_TITLES
 */
export const DOMAIN_VIEW_MODULE_TITLES: Record<
  DomainView,
  Partial<Record<ModuleName, string>>
> = {
  'ai-agents': {},
  mcp: {},
  backend: {},
  mobile: {
    [ModuleName.HTTP]: HTTP_MOBILE_MODULE_TITLE,
  },
  frontend: {
    [ModuleName.HTTP]: HTTP_FRONTEND_MODULE_TITLE,
  },
};
