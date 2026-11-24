import {AGENTS_LANDING_TITLE} from './agents/settings';
import {BACKEND_LANDING_TITLE} from './backend/settings';
import {FRONTEND_LANDING_TITLE} from './frontend/settings';
import {MCP_LANDING_TITLE} from './mcp/settings';
import {MOBILE_LANDING_TITLE} from './mobile/settings';
import type {DomainView} from './useFilters';

export const DOMAIN_VIEW_TITLES: Record<DomainView, string> = {
  backend: BACKEND_LANDING_TITLE,
  frontend: FRONTEND_LANDING_TITLE,
  mobile: MOBILE_LANDING_TITLE,
  'ai-agents': AGENTS_LANDING_TITLE,
  mcp: MCP_LANDING_TITLE,
};
