import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  RESOURCE_TYPE = 'type',
  PAGE = 'transaction',
  DOMAIN = 'domain',
  GROUP_ID = 'groupId',
  DESCRIPTION = 'description',
}

export type ModuleFilters = {
  [BrowserStarfishFields.DOMAIN]?: string;
  [BrowserStarfishFields.RESOURCE_TYPE]?: 'resource.script' | 'resource.img';
  [BrowserStarfishFields.PAGE]?: string;
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.DOMAIN,
    BrowserStarfishFields.RESOURCE_TYPE,
    BrowserStarfishFields.PAGE,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
  ]);
};
