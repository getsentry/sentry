import {Location} from 'history';
import trimStart from 'lodash/trimStart';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {NewQuery, Organization, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {getCurrentTrendParameter} from 'sentry/views/performance/trends/utils';
import {getMiddleTimestamp} from 'sentry/views/starfish/utils/dates';

const DEFAULT_STATS_PERIOD = '7d';

const TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH = ['transaction'];
export const TIME_SPENT_IN_SERVICE =
  'equation|sum(transaction.duration) / total.transaction_duration';

export const getDefaultStatsPeriod = (organization: Organization) => {
  if (organization?.features?.includes('performance-landing-page-stats-period')) {
    return '14d';
  }
  return DEFAULT_STATS_PERIOD;
};

function prepareQueryForLandingPage(searchQuery, withStaticFilters) {
  const conditions = new MutableSearch(searchQuery);

  // If there is a bare text search, we want to treat it as a search
  // on the transaction name.
  if (conditions.freeText.length > 0) {
    const parsedFreeText = conditions.freeText.join(' ');

    // the query here is a user entered condition, no need to escape it
    conditions.setFilterValues(
      'transaction',
      [wrapQueryInWildcards(parsedFreeText)],
      false
    );
    conditions.freeText = [];
  }
  if (withStaticFilters) {
    conditions.tokens = conditions.tokens.filter(
      token => token.key && TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH.includes(token.key)
    );
  }
  return conditions.formatString();
}

function generateGenericPerformanceEventView(
  location: Location,
  withStaticFilters: boolean,
  organization: Organization
): EventView {
  const {query} = location;

  const fields = ['transaction', 'http.method', 'tpm()', 'p50()', 'p95()', 'project'];

  const hasStartAndEnd = query.start && query.end;
  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction has:http.method',
    projects: [],
    fields,
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = getDefaultStatsPeriod(organization);
  }
  savedQuery.orderby = decodeScalar(query.sort, '-tpm');

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = prepareQueryForLandingPage(searchQuery, withStaticFilters);

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);
  eventView.additionalConditions.addFilterValues('event.type', ['transaction']);

  if (query.trendParameter) {
    // projects and projectIds are not necessary here since trendParameter will always
    // be present in location and will not be determined based on the project type
    const trendParameter = getCurrentTrendParameter(location, [], []);
    if (WEB_VITAL_DETAILS[trendParameter.column]) {
      eventView.additionalConditions.addFilterValues('has', [trendParameter.column]);
    }
  }

  return eventView;
}

export function generatePerformanceEventView(
  location: Location,
  _: Project[],
  {isTrends = false, withStaticFilters = false} = {},
  organization: Organization
) {
  const eventView = generateGenericPerformanceEventView(
    location,
    withStaticFilters,
    organization
  );
  if (isTrends) {
    return eventView;
  }

  return eventView;
}

export function generateWebServiceEventView(
  location: Location,
  _: Project[],
  {withStaticFilters = false} = {},
  organization: Organization
) {
  const {query} = location;
  const hasStartAndEnd = query.start && query.end;
  const middleTimestamp = getMiddleTimestamp({
    start: decodeScalar(query.start),
    end: decodeScalar(query.end),
    statsPeriod:
      !query.statsPeriod && !hasStartAndEnd
        ? getDefaultStatsPeriod(organization)
        : decodeScalar(query.statsPeriod),
  });

  const deltaColName = `equation|(percentile_range(transaction.duration,0.50,lessOrEquals,${middleTimestamp})-percentile_range(transaction.duration,0.50,greater,${middleTimestamp}))/percentile_range(transaction.duration,0.50,lessOrEquals,${middleTimestamp})`;
  let orderby = decodeScalar(query.sort, `-${TIME_SPENT_IN_SERVICE}`);
  const isDescending = orderby.startsWith('-');
  const rawOrderby = trimStart(orderby, '-');
  if (
    rawOrderby.startsWith(
      'equation|(percentile_range(transaction.duration,0.50,lessOrEquals,'
    )
  ) {
    orderby = isDescending ? `-${deltaColName}` : deltaColName;
  }

  const fields = [
    'transaction',
    'http.method',
    'tpm()',
    'p50()',
    deltaColName,
    'count_if(http.status_code,greaterOrEquals,500)',
    TIME_SPENT_IN_SERVICE,
    'total.transaction_duration',
    'sum(transaction.duration)',
    `percentile_range(transaction.duration,0.50,lessOrEquals,${middleTimestamp})`,
    `percentile_range(transaction.duration,0.50,greater,${middleTimestamp})`,
  ];

  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction has:http.method transaction.op:http.server',
    projects: [],
    fields,
    version: 2,
  };

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = getDefaultStatsPeriod(organization);
  }
  savedQuery.orderby = orderby;

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = `${savedQuery.query} ${prepareQueryForLandingPage(
    searchQuery,
    withStaticFilters
  )}`;

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  return eventView;
}
