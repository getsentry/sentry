import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import space from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

type Props = {
  eventView: EventView;
  isFetching: boolean;
  location: Location<ReplayListLocationQuery>;
  organization: Organization;
  pageLinks: string | null;
  replays: ReplayListRecord[];
};

function ReplaysContent({
  eventView,
  isFetching,
  location,
  organization,
  pageLinks,
  replays,
}: Props) {
  const query = location.query;

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

  return (
    <Layout.Main fullWidth>
      <FilterActions>
        <PageFilterBar condensed>
          <EnvironmentPageFilter />
          <DatePageFilter alignDropdown="left" />
        </PageFilterBar>
        <SearchBar
          organization={organization}
          projectIds={eventView.project}
          query={query.query}
          fields={eventView.fields}
          onSearch={handleChange('query')}
        />
      </FilterActions>
      <ReplayTable
        isFetching={isFetching}
        replays={replays}
        showProjectColumn={false}
        sort={eventView.sorts[0]}
      />
      <Pagination pageLinks={pageLinks} />
    </Layout.Main>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr;
  }
`;

export default ReplaysContent;
