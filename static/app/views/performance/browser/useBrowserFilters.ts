import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  TRANSACTION_OP = 'transaction.op',
  COMPONENT = 'component',
  PAGE = 'page',
}

export type ModuleFilters = {
  [BrowserStarfishFields.TRANSACTION_OP]?: string;
  [BrowserStarfishFields.COMPONENT]?: string;
  [BrowserStarfishFields.PAGE]?: string;
};

export const useBrowserModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.TRANSACTION_OP,
    BrowserStarfishFields.COMPONENT,
    BrowserStarfishFields.PAGE,
  ]);
};
