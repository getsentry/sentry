import {AGENTS_LANDING_TITLE} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_TITLE} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_TITLE} from 'sentry/views/insights/pages/mobile/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

export const DOMAIN_VIEW_TITLES: Record<DomainView, string> = {
  backend: BACKEND_LANDING_TITLE,
  frontend: FRONTEND_LANDING_TITLE,
  mobile: MOBILE_LANDING_TITLE,
  ai: AGENTS_LANDING_TITLE,
};
