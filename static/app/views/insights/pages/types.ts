import {AI_LANDING_TITLE} from 'sentry/views/insights/pages/ai/settings';
import {BACKEND_LANDING_TITLE} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_TITLE} from 'sentry/views/insights/pages/frontend/settings';
import {MOBILE_LANDING_TITLE} from 'sentry/views/insights/pages/mobile/settings';
import type {DomainView} from 'sentry/views/insights/pages/useFilters';

export const DOMAIN_VIEW_TITLES: Record<DomainView, string> = {
  ai: AI_LANDING_TITLE,
  backend: BACKEND_LANDING_TITLE,
  frontend: FRONTEND_LANDING_TITLE,
  mobile: MOBILE_LANDING_TITLE,
};
