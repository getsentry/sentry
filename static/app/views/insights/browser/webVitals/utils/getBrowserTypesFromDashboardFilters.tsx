import {
  getInitialInputValue,
  getSelectedValuesFromText,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {deriveFilterState} from 'sentry/views/dashboards/globalFilter/utils';
import {
  WidgetType,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {SpanFields} from 'sentry/views/insights/types';

import {BrowserType, decode} from './queryParameterDecoders/browserType';

// The panels query spans, so the spans filter wins when both are set.
const DATASET_PRIORITY = [WidgetType.SPANS, WidgetType.TRACEMETRICS];

/**
 * Reads the browsers picked in the dashboard's `browser.name` global filter.
 * "is" filters map to the picked browsers. "contains" filters, the default for
 * new filters, map to every known browser whose name contains a picked value,
 * so "contains Chrome" covers both Chrome and Chrome Mobile.
 * Returns an empty list for no filter or any other kind of filter.
 */
export function getBrowserTypesFromDashboardFilters(
  dashboardFilters: DashboardFilters | undefined
): BrowserType[] {
  const browserFilters = (dashboardFilters?.globalFilter ?? []).filter(
    filter => filter.tag.key === SpanFields.BROWSER_NAME && filter.value !== ''
  );

  for (const dataset of DATASET_PRIORITY) {
    const browserFilter = browserFilters.find(filter => filter.dataset === dataset);
    if (browserFilter) {
      return getBrowserTypesFromGlobalFilter(browserFilter);
    }
  }

  return [];
}

function getBrowserTypesFromGlobalFilter(globalFilter: GlobalFilter): BrowserType[] {
  const {filterToken, noValueToken} = deriveFilterState(globalFilter);

  if (!filterToken || noValueToken || filterToken.negated) {
    return [];
  }

  const values = getSelectedValuesFromText(getInitialInputValue(filterToken, true)).map(
    item => item.value
  );

  if (filterToken.operator === TermOperator.DEFAULT) {
    return decode(values);
  }

  if (filterToken.operator === TermOperator.CONTAINS) {
    const needles = values.filter(Boolean).map(value => value.toLowerCase());
    return Object.values(BrowserType).filter(
      browserType =>
        browserType !== BrowserType.ALL &&
        needles.some(needle => browserType.toLowerCase().includes(needle))
    );
  }

  return [];
}
