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

import {Replay} from './types';

type Props = {
  replayList: Replay[];
  selection: PageFilters;
};

type ReplayDurationAndErrors = {
  count_if_event_type_equals_error: number;
  'equation[0]': number;
  id: string;
  max_timestamp: string;
  min_timestamp: string;
  replayId: string;
};

function ReplayTable({replayList, selection}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints[0]})`);

  const getEventView = () => {
    const query = replayList.map(item => `replayId:${item.id}`).join(' OR ');
    const eventQueryParams: NewQuery = {
      id: '',
      name: '',
      version: 2,
      fields: [
        'replayId',
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
          ? Object.fromEntries(
              (data.tableData?.data as ReplayDurationAndErrors[]).map(item => [
                item.replayId,
                item,
              ])
            )
          : {};
        return replayList?.map(replay => {
          return (
            <Fragment key={replay.id}>
              <UserBadge
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
                  username: replay['user.username'] ?? '',
                  id: replay['user.id'] ?? '',
                  ip_address: replay['user.ip_address'] ?? '',
                  name: replay['user.name'] ?? '',
                  email: replay['user.email'] ?? '',
                }}
                // this is the subheading for the avatar, so displayEmail in this case is a misnomer
                displayEmail={getUrlPathname(replay.url) ?? ''}
              />
              {isScreenLarge && (
                <Item>
                  <ProjectBadge
                    project={
                      projects.find(p => p.slug === replay.project) || {
                        slug: replay.project,
                      }
                    }
                    avatarSize={16}
                  />
                </Item>
              )}
              <Item>
                <TimeSinceWrapper>
                  {isScreenLarge && (
                    <StyledIconCalendarWrapper color="gray500" size="sm" />
                  )}
                  <TimeSince date={replay.timestamp} />
                </TimeSinceWrapper>
              </Item>
              {data.tableData ? (
                <React.Fragment>
                  <Item>
                    <Duration
                      seconds={
                        Math.floor(
                          dataEntries[replay.id]
                            ? dataEntries[replay.id]['equation[0]']
                            : 0
                        ) || 1
                      }
                      exact
                      abbreviation
                    />
                  </Item>
                  <Item>
                    {dataEntries[replay.id]
                      ? dataEntries[replay.id]?.count_if_event_type_equals_error
                      : 0}
                  </Item>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <Item>
                    <Placeholder height="24px" />
                  </Item>
                  <Item>
                    <Placeholder height="24px" />
                  </Item>
                </React.Fragment>
              )}
            </Fragment>
          );
        });
      }}
    </DiscoverQuery>
  );
}

const Item = styled('div')`
  display: flex;
  align-items: center;
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
