import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';

export enum BrowserStarfishFields {
  SPAN_OP = 'span.op',
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
  [BrowserStarfishFields.SPAN_OP]?:
    | 'resource.script'
    | 'resource.css'
    | 'resource.font'
    | 'resource.img';
  [BrowserStarfishFields.TRANSACTION]?: string;
  [BrowserStarfishFields.SPAN_DOMAIN]?: string;
};

export const useResourceModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.SPAN_DOMAIN,
    BrowserStarfishFields.SPAN_OP,
    BrowserStarfishFields.TRANSACTION,
    BrowserStarfishFields.GROUP_ID,
    BrowserStarfishFields.DESCRIPTION,
    BrowserStarfishFields.RESOURCE_RENDER_BLOCKING_STATUS,
  ]);
};
