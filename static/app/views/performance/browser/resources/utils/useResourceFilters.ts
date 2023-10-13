import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  RESOURCE_TYPE = 'type',
  TRANSACTION = 'transaction',
  SPAN_DOMAIN = 'span.domain',
  GROUP_ID = 'groupId',
  DESCRIPTION = 'description',
}

export type ModuleFilters = {
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
  [BrowserStarfishFields.RESOURCE_TYPE]?: 'resource.script' | 'resource.img';
  [BrowserStarfishFields.TRANSACTION]?: string;
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.SPAN_DOMAIN,
    BrowserStarfishFields.RESOURCE_TYPE,
    BrowserStarfishFields.TRANSACTION,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
  ]);
};
