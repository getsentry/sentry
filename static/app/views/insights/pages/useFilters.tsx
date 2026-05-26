import {useLocation} from 'sentry/utils/useLocation';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MCP_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mcp/settings';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

export type DomainView =
  | typeof FRONTEND_LANDING_SUB_PATH
  | typeof BACKEND_LANDING_SUB_PATH
  | typeof AGENTS_LANDING_SUB_PATH
  | typeof MCP_LANDING_SUB_PATH
  | typeof MOBILE_LANDING_SUB_PATH;

export const domainViews: DomainView[] = [
  FRONTEND_LANDING_SUB_PATH,
  BACKEND_LANDING_SUB_PATH,
  MOBILE_LANDING_SUB_PATH,
  AGENTS_LANDING_SUB_PATH,
  MCP_LANDING_SUB_PATH,
];

export type DomainViewFilters = {
  isInDomainView?: boolean;
  isInOverviewPage?: boolean;
  view?: DomainView;
};

export const useDomainViewFilters = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const indexOfInsights = pathSegments.indexOf(DOMAIN_VIEW_BASE_URL);
  const isInDomainView = indexOfInsights !== -1;
  const view = pathSegments[indexOfInsights + 1] as DomainViewFilters['view'];
  const isInOverviewPage = pathSegments.length === indexOfInsights + 2; // Used to check if is in laravel/nextjs page

  if (!view || !domainViews.includes(view)) {
    return {isInDomainView: false};
  }

  if (isInDomainView) {
    return {
      view,
      isInDomainView,
      isInOverviewPage,
    };
  }

  return {isInDomainView};
};
