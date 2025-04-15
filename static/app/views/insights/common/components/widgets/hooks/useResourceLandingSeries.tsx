import type {PageFilters} from 'sentry/types/core';
import {EMPTY_OPTION_VALUE, MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getResourceTypeFilter} from 'sentry/views/insights/browser/common/queries/useResourcesQuery';
import {DEFAULT_RESOURCE_TYPES} from 'sentry/views/insights/browser/resources/settings';
import {
  BrowserStarfishFields,
  useResourceModuleFilters,
} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {useSpanMetricsSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import type {ModuleFilters} from 'sentry/views/insights/common/views/spans/types';
import {SpanMetricsField} from 'sentry/views/insights/types';

const {SPAN_SELF_TIME, NORMALIZED_DESCRIPTION, SPAN_DOMAIN} = SpanMetricsField;
const {SPAN_DOMAIN: STARFISH_SPAN_DOMAIN, USER_GEO_SUBREGION} = BrowserStarfishFields;

const SPAN_FILTER_KEYS = ['span_operation', SPAN_DOMAIN, 'action'];

const buildDiscoverQueryConditions = (appliedFilters: ModuleFilters) => {
  const result = Object.keys(appliedFilters)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    .filter(key => Boolean(appliedFilters[key]))
    .map(key => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const value = appliedFilters[key];
      if (key === SPAN_DOMAIN && value === EMPTY_OPTION_VALUE) {
        return [`!has:${SPAN_DOMAIN}`];
      }
      return `${key}:${value}`;
    });

  result.push(`has:${NORMALIZED_DESCRIPTION}`);

  return result.join(' ');
};

interface Props {
  pageFilters?: PageFilters;
}

export function useResourceLandingSeries(props: Props = {}) {
  const filters = useResourceModuleFilters();

  const spanTimeChartsFilters: ModuleFilters = {
    'span.op': `[${DEFAULT_RESOURCE_TYPES.join(',')}]`,
    ...(filters[STARFISH_SPAN_DOMAIN]
      ? {[STARFISH_SPAN_DOMAIN]: filters[STARFISH_SPAN_DOMAIN]}
      : {}),
  };

  const extraQuery = [
    ...getResourceTypeFilter(undefined, DEFAULT_RESOURCE_TYPES),
    ...(filters[USER_GEO_SUBREGION]
      ? [`user.geo.subregion:[${filters[USER_GEO_SUBREGION].join(',')}]`]
      : []),
  ];

  let query: string = buildDiscoverQueryConditions(spanTimeChartsFilters);

  if (extraQuery) {
    query += ` ${extraQuery.join(' ')}`;
  }

  return useSpanMetricsSeries(
    {
      search: new MutableSearch(query),
      yAxis: ['epm()', `avg(${SPAN_SELF_TIME})`],
      transformAliasToInputFormat: true,
    },
    'api.starfish.span-time-charts',
    props.pageFilters
  );
}
