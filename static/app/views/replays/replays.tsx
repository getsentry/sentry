import React, {useEffect, useState} from 'react';
import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent, PageHeader} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {NewQuery, Organization, PageFilters} from 'sentry/types';
import DiscoverQuery from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import AsyncView from 'sentry/views/asyncView';

import ReplaysFilters from './filters';
import {Replay} from './types';

type Props = AsyncView['props'] &
  WithRouterProps<{orgId: string}> & {
    organization: Organization;
    selection: PageFilters;
    statsPeriod?: string | undefined; // revisit i'm sure i'm doing statsperiod wrong
  };

const sanitizeLocationQuery = query => {
  if (!query || Array.isArray(query)) {
    return '';
  }
  return query;
};

function Replays(props: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const [searchQuery, setSearchQuery] = useState<string>(
    sanitizeLocationQuery(location.query.query)
  );

  useEffect(() => {
    setSearchQuery(sanitizeLocationQuery(location.query.query));
  }, [location.query.query]);

  const getEventView = () => {
    const {selection} = props;
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: ['eventID', 'timestamp', 'replayId', 'user.display', 'url'],
      orderby: '-timestamp',
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
      <React.Fragment key={replay.id}>
        <Link
          to={`/organizations/${organization.slug}/replays/${generateEventSlug({
            project: replay['project.name'],
            id: replay.id,
          })}/`}
        >
          <ReplayUserBadge
            avatarSize={32}
            displayName={replay['user.display']}
            user={{
              username: replay['user.display'],
              id: replay['user.display'],
              ip_address: replay['user.display'],
              name: replay['user.display'],
              email: replay['user.display'],
            }}
            // this is the subheading for the avatar, so displayEmail in this case is a misnomer
            displayEmail={replay.url?.split('?')[0] || ''}
          />
        </Link>
        <div>
          <TimeSinceWrapper>
            <StyledIconCalendarWrapper color="gray500" size="sm" />
            <TimeSince date={replay.timestamp} />
          </TimeSinceWrapper>
        </div>
      </React.Fragment>
    ));
  };

  return (
    <React.Fragment>
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
            location={props.location}
            orgSlug={organization.slug}
          >
            {data => {
              return (
                <React.Fragment>
                  <ReplaysFilters
                    query={searchQuery}
                    organization={organization}
                    handleSearchQuery={handleSearchQuery}
                  />
                  <PanelTable
                    isLoading={data.isLoading}
                    isEmpty={data.tableData?.data.length === 0}
                    headers={[t('Session'), t('Timestamp')]}
                  >
                    {data.tableData ? renderTable(data.tableData.data as Replay[]) : null}
                  </PanelTable>
                  <Pagination pageLinks={data.pageLinks} />
                </React.Fragment>
              );
            }}
          </DiscoverQuery>
        </StyledPageContent>
      </PageFiltersContainer>
    </React.Fragment>
  );
}

const StyledPageHeader = styled(PageHeader)`
  background-color: ${p => p.theme.surface100};
  margin-top: ${space(1.5)};
  margin-left: ${space(4)};
`;

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.white};
`;

const HeaderTitle = styled(PageHeading)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
`;

const ReplayUserBadge = styled(UserBadge)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.linkColor};
`;

const TimeSinceWrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(auto, max-content));
  align-items: center;
  gap: ${space(1.5)};
`;

const StyledIconCalendarWrapper = styled(IconCalendar)`
  position: relative;
  top: -1px;
`;

export default withRouter(withPageFilters(withOrganization(Replays)));
