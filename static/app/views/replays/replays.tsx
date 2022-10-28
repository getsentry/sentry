import {Fragment, useMemo} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/filters';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = RouteComponentProps<{orgId: string}, {}, any, ReplayListLocationQuery>;

function Replays({location}: Props) {
  const organization = useOrganization();
  const theme = useTheme();
  const minWidthIsSmall = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location]);

  const {pathname, query} = location;
  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    organization,
    eventView,
  });

  return (
    <Fragment>
      <StyledPageHeader>
        <HeaderTitle>
          {t('Replays')} <ReplaysFeatureBadge space={1} />
        </HeaderTitle>
      </StyledPageHeader>
      <PageFiltersContainer>
        <StyledPageContent>
          <ReplaysFilters
            query={query.query || ''}
            organization={organization}
            handleSearchQuery={searchQuery => {
              browserHistory.push({
                pathname,
                query: {
                  ...query,
                  cursor: undefined,
                  query: searchQuery.trim(),
                },
              });
            }}
          />
          <ReplayTable
            isFetching={isFetching}
            fetchError={fetchError}
            replays={replays}
            showProjectColumn={minWidthIsSmall}
            sort={eventView.sorts[0]}
          />
          <Pagination
            pageLinks={pageLinks}
            onCursor={(cursor, path, searchQuery) => {
              browserHistory.push({
                pathname: path,
                query: {...searchQuery, cursor},
              });
            }}
          />
        </StyledPageContent>
      </PageFiltersContainer>
    </Fragment>
  );
}

const StyledPageHeader = styled(PageHeader)`
  background-color: ${p => p.theme.surface100};
  min-width: max-content;
  margin: ${space(3)} ${space(0)} ${space(4)} ${space(4)};
`;

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

const HeaderTitle = styled(PageHeading)`
  display: flex;
  flex: 1;
`;

export default Replays;
