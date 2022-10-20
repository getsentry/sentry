import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import first from 'lodash/first';
import omit from 'lodash/omit';

import CompactSelect from 'sentry/components/compactSelect';
import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

import type {SpanOperationBreakdownFilter} from '../filter';
import {
  EventsDisplayFilterName,
  getEventsFilterOptions,
  PercentileValues,
} from '../transactionEvents/utils';

import type {ReplayListRecordWithTx} from './useReplaysFromTransaction';

type Props = {
  eventView: EventView;
  eventsDisplayFilterName: EventsDisplayFilterName;
  isFetching: boolean;
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  pageLinks: string | null;
  replays: ReplayListRecordWithTx[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  percentileValues?: PercentileValues;
};

function ReplaysContent({
  eventView,
  eventsDisplayFilterName,
  isFetching,
  location,
  organization,
  pageLinks,
  replays,
  spanOperationBreakdownFilter,
  percentileValues,
}: Props) {
  const query = location.query;

  const eventsFilterOptions = getEventsFilterOptions(
    spanOperationBreakdownFilter,
    percentileValues
  );

  function handleChange(key: string) {
    return function (value: string | undefined) {
      const queryParams = normalizeDateTimeParams({
        ...(location.query || {}),
        [key]: value,
      });

      // do not propagate pagination when making a new search
      const toOmit = ['cursor'];
      if (!defined(value)) {
        toOmit.push(key);
      }
      const searchQueryParams = omit(queryParams, toOmit);

      browserHistory.push({
        ...location,
        query: searchQueryParams,
      });
    };
  }

  const handleEventDisplayFilterChange = (newFilterName: EventsDisplayFilterName) => {
    const nextQuery: Location['query'] = {
      ...location.query,
      showTransactions: newFilterName,
    };

    if (newFilterName === EventsDisplayFilterName.p100) {
      delete nextQuery.showTransaction;
    }

    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  return (
    <Layout.Main fullWidth>
      <FilterActions>
        <PageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
        <StyledSearchBar
          organization={organization}
          projectIds={eventView.project}
          query={query.query}
          fields={eventView.fields}
          onSearch={handleChange('query')}
        />
        <PercentileSelect
          triggerProps={{prefix: t('Percentile')}}
          value={eventsDisplayFilterName}
          onChange={opt => handleEventDisplayFilterChange(opt.value)}
          options={Object.entries(eventsFilterOptions).map(([name, filter]) => ({
            value: name as EventsDisplayFilterName,
            label: filter.label,
          }))}
        />
      </FilterActions>
      <ReplayTable
        isFetching={isFetching}
        replays={replays}
        showProjectColumn={false}
        sort={first(eventView.sorts) || {field: 'startedAt', kind: 'asc'}}
        showSlowestTxColumn
      />
      <Pagination pageLinks={pageLinks} />
    </Layout.Main>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  grid-template-columns: repeat(2, 1fr);

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr auto;
  }
`;

const PercentileSelect = styled(CompactSelect)`
  order: 2;
  justify-self: flex-end;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 3;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  order: 3;
  grid-column: span 2;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 2;
    grid-column: span 1;
  }
`;

export default ReplaysContent;
