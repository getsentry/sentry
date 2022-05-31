import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {NewQuery} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {getQueryParamAsString} from 'sentry/utils/replays/getQueryParamAsString';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import ReplaysFilters from './filters';
import ReplayTable from './replayTable';
import {Replay} from './types';

const columns = [t('Session'), t('Project')];

function Replays() {
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[0]})`);

  const [searchQuery, setSearchQuery] = useState<string>(
    getQueryParamAsString(location.query.query)
  );

  useEffect(() => {
    setSearchQuery(getQueryParamAsString(location.query.query));
  }, [location.query.query]);

  const getEventView = () => {
    const {query} = location;
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: [
        // 'id' is always returned, don't need to list it here.
        'eventID',
        'project',
        'timestamp',
        'url',
        'user.display',
        'user.email',
        'user.id',
        'user.ip_address',
        'user.name',
        'user.username',
      ],
      orderby: getQueryParamAsString(query.sort) || '-timestamp',
      environment: selection.environments,
      projects: selection.projects,
      query: `title:sentry-replay ${searchQuery}`,
    };

    if (selection.datetime.period) {
      eventQueryParams.range = selection.datetime.period;
    }
    return EventView.fromNewQueryWithLocation(eventQueryParams, location);
  };

  const handleSearchQuery = (query: string) => {
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        cursor: undefined,
        query: String(query).trim() || undefined,
      },
    });
  };

  const {query} = location;
  const {cursor: _cursor, page: _page, ...currentQuery} = query;

  const sort: {
    field: string;
  } = {
    field: getQueryParamAsString(query.sort) || '-timestamp',
  };

  const arrowDirection = sort.field.startsWith('-') ? 'down' : 'up';
  const sortArrow = <IconArrow color="gray300" size="xs" direction={arrowDirection} />;

  return (
    <Fragment>
      <StyledPageHeader>
        <HeaderTitle>
          <div>
            {t('Replays')} <FeatureBadge type="alpha" />
          </div>
        </HeaderTitle>
      </StyledPageHeader>
      <PageFiltersContainer hideGlobalHeader resetParamsOnChange={['cursor']}>
        <StyledPageContent>
          <DiscoverQuery
            eventView={getEventView()}
            location={location}
            orgSlug={organization.slug}
            limit={15}
          >
            {data => {
              return (
                <Fragment>
                  <ReplaysFilters
                    query={searchQuery}
                    organization={organization}
                    handleSearchQuery={handleSearchQuery}
                  />
                  <StyledPanelTable
                    isLoading={data.isLoading}
                    isEmpty={data.tableData?.data.length === 0}
                    headers={[
                      ...(!isScreenLarge
                        ? columns.filter(col => col === t('Session'))
                        : columns),
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
                            // sort by timestamp should start by ascending on first click
                            sort:
                              sort.field === '-timestamp' ? 'timestamp' : '-timestamp',
                          },
                        }}
                      >
                        {t('Timestamp')} {sort.field.endsWith('timestamp') && sortArrow}
                      </SortLink>,
                      t('Duration'),
                      t('Errors'),
                    ]}
                  >
                    {data.tableData ? (
                      <ReplayTable
                        showProjectColumn
                        replayList={data.tableData.data as Replay[]}
                      />
                    ) : null}
                  </StyledPanelTable>
                  <Pagination pageLinks={data.pageLinks} />
                </Fragment>
              );
            }}
          </DiscoverQuery>
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

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content max-content max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
  }
`;

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
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

export default Replays;
