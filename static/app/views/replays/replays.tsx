import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {NewQuery, PageFilters} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getUrlPathname from 'sentry/utils/getUrlPathname';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withPageFilters from 'sentry/utils/withPageFilters';

import ReplaysFilters from './filters';
import {Replay} from './types';

type Props = {
  selection: PageFilters;
};

// certain query params can be either a string or an array of strings
// so if we have an array we reduce it down to a string
const getQueryParamAsString = query => {
  if (!query) {
    return '';
  }
  return Array.isArray(query) ? query.join(' ') : query;
};

const columns = [t('Session'), t('Project')];

function Replays(props: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[0]})`);

  const [searchQuery, setSearchQuery] = useState<string>(
    getQueryParamAsString(location.query.query)
  );

  useEffect(() => {
    setSearchQuery(getQueryParamAsString(location.query.query));
  }, [location.query.query]);

  const getEventView = () => {
    const {selection} = props;
    const {query} = location;
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: ['eventID', 'project', 'timestamp', 'user.display', 'url'],
      orderby: getQueryParamAsString(query.sort) || '-timestamp',
      environment: selection.environments,
      projects: selection.projects,
      query: `transaction:sentry-replay ${searchQuery}`, // future: change to replay event
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

  const renderTable = (replayList: Array<Replay>) => {
    return replayList?.map(replay => (
      <Fragment key={replay.id}>
        <ReplayUserBadge
          avatarSize={32}
          displayName={
            <Link
              to={`/organizations/${organization.slug}/replays/${generateEventSlug({
                project: replay.project,
                id: replay.id,
              })}/`}
            >
              {replay['user.display']}
            </Link>
          }
          user={{
            username: replay['user.display'],
            id: replay['user.display'],
            ip_address: replay['user.display'],
            name: replay['user.display'],
            email: replay['user.display'],
          }}
          // this is the subheading for the avatar, so displayEmail in this case is a misnomer
          displayEmail={getUrlPathname(replay.url) ?? ''}
        />
        {isScreenLarge && (
          <StyledPanelItem>
            <ProjectBadge
              project={
                projects.find(p => p.slug === replay.project) || {slug: replay.project}
              }
              avatarSize={16}
            />
          </StyledPanelItem>
        )}
        <StyledPanelItem>
          <TimeSinceWrapper>
            <StyledIconCalendarWrapper color="gray500" size="sm" />
            <TimeSince date={replay.timestamp} />
          </TimeSinceWrapper>
        </StyledPanelItem>
      </Fragment>
    ));
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
                    ]}
                  >
                    {data.tableData ? renderTable(data.tableData.data as Replay[]) : null}
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
  margin-top: ${space(1.5)};
  margin-left: ${space(4)};
`;

const StyledPageContent = styled(PageContent)`
  padding: ${space(1.5)} ${space(2)};
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: minmax(0, 1fr) max-content max-content;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: minmax(0, 1fr) max-content;
  }
`;

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;

const StyledPanelItem = styled('div')`
  margin-top: ${space(0.75)};
`;

const ReplayUserBadge = styled(UserBadge)`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 400;
  line-height: 1.2;
`;

const TimeSinceWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(auto, max-content));
  align-items: center;
  gap: ${space(1)};
`;

const StyledIconCalendarWrapper = styled(IconCalendar)`
  position: relative;
  top: -1px;
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

export default withPageFilters(Replays);
