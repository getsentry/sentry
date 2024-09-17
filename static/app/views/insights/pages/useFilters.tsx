import pick from 'lodash/pick';
import type {ModuleName} from 'webpack-cli';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

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
