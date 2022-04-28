import React, {Fragment} from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
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

import mergeReplayEntries from './utils/mergeReplayEntries';
import {Replay} from './types';

type Props = {
  replayList: Replay[];
  selection: PageFilters;
};

function ReplayTable(props: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const {replayList} = props;
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[0]})`);

  const getEventView = () => {
    const {selection} = props;
    const query = replayList.map(item => `replayId:${item.id}`).join(' OR ');
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: [
        'replayId',
        'project',
        'max(timestamp)',
        'min(timestamp)',
        'equation|max(timestamp)-min(timestamp)',
        'count_if(event.type,equals,error)',
      ],
      orderby: '-min_timestamp',
      environment: selection.environments,
      projects: selection.projects,
      query: `(title:sentry-replay-event OR event.type:error) AND (${query})`,
    };

    if (selection.datetime.period) {
      eventQueryParams.range = selection.datetime.period;
    }
    return EventView.fromNewQueryWithLocation(eventQueryParams, location);
  };

  return (
    <DiscoverQuery
      eventView={getEventView()}
      location={location}
      orgSlug={organization.slug}
    >
      {data => {
        const dataEntries = data.tableData
          ? mergeReplayEntries(data.tableData?.data as Replay[], 'replayId')
          : null;
        return replayList?.map(replay => {
          return (
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
                      projects.find(p => p.slug === replay.project) || {
                        slug: replay.project,
                      }
                    }
                    avatarSize={16}
                  />
                </StyledPanelItem>
              )}
              <StyledPanelItem>
                <TimeSinceWrapper>
                  {isScreenLarge && (
                    <StyledIconCalendarWrapper color="gray500" size="sm" />
                  )}
                  <TimeSince date={replay.timestamp} />
                </TimeSinceWrapper>
              </StyledPanelItem>
              {data.tableData && dataEntries ? (
                <React.Fragment>
                  <React.Fragment>
                    <StyledPanelItem>
                      <Duration
                        seconds={
                          dataEntries[replay.id]
                            ? dataEntries[replay.id]['equation[0]'] / 1000
                            : 0
                        }
                        fixedDigits={2}
                        abbreviation
                      />
                    </StyledPanelItem>
                    <StyledPanelItem>
                      {dataEntries[replay.id]
                        ? dataEntries[replay.id]?.count_if_event_type_equals_error
                        : 0}
                    </StyledPanelItem>
                  </React.Fragment>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <StyledPanelItem>
                    <Placeholder height="24px" />
                  </StyledPanelItem>
                  <StyledPanelItem>
                    <Placeholder height="24px" />
                  </StyledPanelItem>
                </React.Fragment>
              )}
            </Fragment>
          );
        });
      }}
    </DiscoverQuery>
  );
}

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

export default withPageFilters(ReplayTable);
