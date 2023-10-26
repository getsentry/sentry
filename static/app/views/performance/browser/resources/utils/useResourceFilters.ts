import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  RESOURCE_TYPE = 'type',
  TRANSACTION = 'transaction',
  SPAN_DOMAIN = 'span.domain',
  GROUP_ID = 'groupId',
  DESCRIPTION = 'description',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
}

export type ModuleFilters = {
  [BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS]:
    | ''
    | 'non-blocking'
    | 'blocking'
    | '!blocking';
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
  [BrowserStarfishFields.RESOURCE_TYPE]?:
    | 'resource.script'
    | 'resource.css'
    | 'resource.img';
  [BrowserStarfishFields.TRANSACTION]?: string;
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.SPAN_DOMAIN,
    BrowserStarfishFields.RESOURCE_TYPE,
    BrowserStarfishFields.TRANSACTION,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
    BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS,
  ]);
};
