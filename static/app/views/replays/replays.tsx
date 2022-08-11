import {Fragment, useMemo} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
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
import useReplayList, {
  DEFAULT_SORT,
  INDEX_FIELDS,
  ReplayListLocationQuery,
} from 'sentry/utils/replays/hooks/useReplayList';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/filters';
import ReplayTable from 'sentry/views/replays/replayTable';

type Props = RouteComponentProps<{orgId: string}, {}, any, ReplayListLocationQuery>;

function Replays({location}: Props) {
  const organization = useOrganization();
  const minWidthIsSmall = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const eventView = useMemo(() => {
    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: INDEX_FIELDS,
        projects: [],
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location]);

  const {pathname, query} = location;
  const {replays, pageLinks, isFetching} = useReplayList({
    organization,
    eventView,
  });

  return (
    <Fragment>
      <StyledPageHeader>
        <HeaderTitle>
          <div>
            {t('Replays')} <ReplaysFeatureBadge />
          </div>
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
            replays={replays}
            showProjectColumn={minWidthIsSmall}
            sort={eventView.sorts[0]}
          />
          <Pagination
            pageLinks={pageLinks}
            onCursor={(offset, path, searchQuery) => {
              browserHistory.push({
                pathname: path,
                query: {...searchQuery, offset},
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
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;

export default Replays;
