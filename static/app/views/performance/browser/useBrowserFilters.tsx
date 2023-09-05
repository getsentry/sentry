import pick from 'lodash/pick';

import {useLocation} from 'sentry/utils/useLocation';
import {SpanMetricsField} from 'sentry/views/starfish/types';

export enum BrowserStarfishFields {
  SPAN_ACTION = SpanMetricsField.SPAN_ACTION,
  COMPONENT = 'component',
  PAGE = 'page',
}

export type ModuleFilters = {
  [BrowserStarfishFields.SPAN_ACTION]?: string;
  [BrowserStarfishFields.COMPONENT]?: string;
  [BrowserStarfishFields.PAGE]?: string;
};

export const useBrowserModuleFilters = () => {
  const location = useLocation<ModuleFilters>();

  return pick(location.query, [
    BrowserStarfishFields.SPAN_ACTION,
    BrowserStarfishFields.COMPONENT,
    BrowserStarfishFields.PAGE,
  ]);
};
