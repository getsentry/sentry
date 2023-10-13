import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  RESOURCE_TYPE = 'type',
  TRANSACTION = 'transaction',
  DOMAIN = 'domain',
  GROUP_ID = 'groupId',
  DESCRIPTION = 'description',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
}

export type ModuleFilters = {
  [BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS]:
    | ''
    | 'non-blocking'
    | 'blocking';
  [BrowserStarfishFields.RESOURCE_TYPE]?: 'resource.script' | 'resource.img';
  [BrowserStarfishFields.TRANSACTION]?: string;
  [BrowserStarfishFields.DOMAIN]?: string;
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.DOMAIN,
    BrowserStarfishFields.RESOURCE_TYPE,
    BrowserStarfishFields.TRANSACTION,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
    BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS,
  ]);
};
