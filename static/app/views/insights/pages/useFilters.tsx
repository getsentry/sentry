import type {ModuleName} from 'webpack-cli';

import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/aiLandingPage';
import type {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backendLandingPage';
import type {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontendLandingPage';
import type {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobileLandingPage';

export type Filters = {
  hasSubpage?: boolean;
  isInDomainView?: boolean;
  module?: ModuleName;
  view?:
    | typeof FRONTEND_LANDING_SUB_PATH
    | typeof BACKEND_LANDING_SUB_PATH
    | typeof AI_LANDING_SUB_PATH
    | typeof MOBILE_LANDING_SUB_PATH;
};

export const useFilters = (): Filters => {
  const location = useLocation();
  const pathSegements = location.pathname.split('/').filter(Boolean);
  const indexOfPerformance = pathSegements.indexOf('performance');
  const isInDomainView = indexOfPerformance !== -1;

  const view = pathSegements[indexOfPerformance + 1] as Filters['view'];
  const module = pathSegements[indexOfPerformance + 2] as ModuleName;
  const hasSubpage = pathSegements.length > indexOfPerformance + 3;

  if (isInDomainView) {
    return {
      module,
      hasSubpage,
      view,
      isInDomainView,
    };
  }
  return {isInDomainView};
};

export const useUpdateFilters = () => {
  const {slug} = useOrganization();
  const navigate = useNavigate();
  const {view} = useFilters();
  const baseUrl = normalizeUrl(`/organizations/${slug}/performance/${view}`);

  return (newFilters: Filters) => {
    navigate({
      pathname: newFilters.module ? `${baseUrl}/${newFilters.module}/` : baseUrl,
      query: {},
    });
  };
};
