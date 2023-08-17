import {Location} from 'history';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {wrapQueryInWildcards} from 'sentry/components/performance/searchBar';
import {t} from 'sentry/locale';
import {NewQuery, Organization, PageFilters} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {STARFISH_TYPE_FOR_PROJECT} from 'sentry/views/starfish/allowedProjects';
import {StarfishType} from 'sentry/views/starfish/types';

const DEFAULT_STATS_PERIOD = '7d';

const TOKEN_KEYS_SUPPORTED_IN_LIMITED_SEARCH = ['transaction'];
export const TIME_SPENT_IN_SERVICE = 'time_spent_percentage()';

const getDefaultStatsPeriod = (organization: Organization) => {
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

export function generateWebServiceEventView(
  location: Location,
  {withStaticFilters = false} = {},
  organization: Organization,
  selection: PageFilters
) {
  const {query} = location;
  const project = selection.projects[0];
  const starfishType = STARFISH_TYPE_FOR_PROJECT[project] || StarfishType.BACKEND;

  const getSavedQuery = () => {
    switch (starfishType) {
      case StarfishType.MOBILE:
        return generateMobileServiceSavedQuery(location);
      case StarfishType.BACKEND:
      default:
        return generateWebServiceSavedQuery(location);
    }
  };

  const savedQuery = getSavedQuery();

  const hasStartAndEnd = query.start && query.end;

  const widths = Array(savedQuery.fields.length).fill(COL_WIDTH_UNDEFINED);
  widths[savedQuery.fields.length - 1] = '110';
  savedQuery.widths = widths;

  if (!query.statsPeriod && !hasStartAndEnd) {
    savedQuery.range = getDefaultStatsPeriod(organization);
  }

  const searchQuery = decodeScalar(query.query, '');
  savedQuery.query = `${savedQuery.query} ${prepareQueryForLandingPage(
    searchQuery,
    withStaticFilters
  )}`;

  const eventView = EventView.fromNewQueryWithLocation(savedQuery, location);

  return eventView;
}

export function generateMobileServiceSavedQuery(location: Location) {
  const {query} = location;
  const orderby = decodeScalar(query.sort, `-eps`);

  const fields = [
    'transaction',
    'eps()',
    'p75(measurements.frames_slow_rate)',
    'p75(measurements.time_to_initial_display)',
  ];

  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction transaction.op:ui.load',
    fields,
    version: 2,
    dataset: DiscoverDatasets.METRICS,
  };
  savedQuery.orderby = orderby;

  return savedQuery;
}

function generateWebServiceSavedQuery(location: Location) {
  const {query} = location;
  const orderby = decodeScalar(query.sort, `-time_spent_percentage`);

  const fields = [
    'transaction',
    'http.method',
    'tps()',
    'avg(transaction.duration)',
    'http_error_count()',
    'time_spent_percentage()',
    'sum(transaction.duration)',
  ];

  const savedQuery: NewQuery = {
    id: undefined,
    name: t('Performance'),
    query: 'event.type:transaction has:http.method transaction.op:http.server',
    fields,
    version: 2,
    dataset: DiscoverDatasets.METRICS,
  };
  savedQuery.orderby = orderby;

  return savedQuery;
}
