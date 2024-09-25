import pick from 'lodash/pick';
import type {ModuleName} from 'webpack-cli';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import type {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/aiLandingPage';
import type {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/backendLandingPage';
import type {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import type {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobileLandingPage';

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

export const useFilters = () => {
  const location = useLocation<Filters>();

  const filters = pick(location.query, ['module']);

  return filters;
};

export const useUpdateFilters = () => {
  const location = useLocation<Filters>();
  const navigate = useNavigate();

  return (newFilters: Filters) => {
    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...newFilters,
      },
    });
  };
};
