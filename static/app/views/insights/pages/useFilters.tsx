import type {ModuleName} from 'webpack-cli';

import {useLocation} from 'sentry/utils/useLocation';
import type {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import type {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import type {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import type {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';

export type DomainView =
  | typeof FRONTEND_LANDING_SUB_PATH
  | typeof BACKEND_LANDING_SUB_PATH
  | typeof AI_LANDING_SUB_PATH
  | typeof MOBILE_LANDING_SUB_PATH;

export type DomainViewFilters = {
  isInDomainView?: boolean;
  view?: DomainView;
};

export type Filters = {
  module?: ModuleName;
};

export const useDomainViewFilters = () => {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const indexOfPerformance = pathSegments.indexOf('performance');
  const isInDomainView = indexOfPerformance !== -1;

  const view = pathSegments[indexOfPerformance + 1] as DomainViewFilters['view'];

  if (isInDomainView) {
    return {
      view,
      isInDomainView,
    };
  }
  return {isInDomainView};
};
