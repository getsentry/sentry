import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import DatePageFilter from 'sentry/components/datePageFilter';
import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {getQueryParamAsString} from 'sentry/utils/replays/getQueryParamAsString';
import ReplayTable from 'sentry/views/replays/replayTable';
import {Replay} from 'sentry/views/replays/types';

import {SetStateAction} from '../types';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  pageLinks: string | null;
  setError: SetStateAction<string | undefined>;
  tableData: TableData;
  transactionName: string;
};

function ReplaysContent(props: Props) {
  const {tableData, pageLinks, location, organization, eventView} = props;

  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
  const query = decodeScalar(location.query.query, '');

  const sort: {
    field: string;
  } = {
    field: getQueryParamAsString(location.query.sort) || '-timestamp',
  };
  const arrowDirection = sort.field.startsWith('-') ? 'down' : 'up';
  const sortArrow = <IconArrow color="gray300" size="xs" direction={arrowDirection} />;

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
          query={query}
          fields={eventView.fields}
          onSearch={handleChange('query')}
        />
      </FilterActions>
      <StyledPanelTable
        isEmpty={tableData.data.length === 0}
        headers={[
          t('Session'),
          <SortLink
            key="timestamp"
            role="columnheader"
            aria-sort={
              !sort.field.endsWith('timestamp')
                ? 'none'
                : sort.field === '-timestamp'
                ? 'descending'
                : 'ascending'
            }
            to={{
              pathname: location.pathname,
              query: {
                ...currentQuery,
                sort: sort.field === '-timestamp' ? 'timestamp' : '-timestamp',
              },
            }}
          >
            {t('Timestamp')} {sort.field.endsWith('timestamp') && sortArrow}
          </SortLink>,
          t('Duration'),
          t('Errors'),
        ]}
      >
        <ReplayTable idKey="replayId" replayList={tableData.data as Replay[]} />
      </StyledPanelTable>
      <Pagination pageLinks={pageLinks} />
    </Layout.Main>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
`;

const SortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 1fr;
  }
`;

export default ReplaysContent;
