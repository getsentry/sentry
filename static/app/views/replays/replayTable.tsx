import React, {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import space from 'sentry/styles/space';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import getUrlPathname from 'sentry/utils/getUrlPathname';
import useDiscoverQuery from 'sentry/utils/replays/hooks/useDiscoveryQuery';
import theme from 'sentry/utils/theme';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {Replay} from './types';

type Props = {
  idKey: string;
  replayList: Replay[];
  showProjectColumn?: boolean;
};

type ReplayDurationAndErrors = {
  count_if_event_type_equals_error: number;
  'equation[0]': number;
  id: string;
  max_timestamp: string;
  min_timestamp: string;
  replayId: string;
};

function ReplayTable({replayList, idKey, showProjectColumn}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const isScreenLarge = useMedia(`(min-width: ${theme.breakpoints.small})`);

  const query = replayList.map(item => `replayId:${item[idKey]}`).join(' OR ');

  const discoverQuery = useMemo(
    () => ({
      fields: [
        'replayId',
        'max(timestamp)',
        'min(timestamp)',
        'equation|max(timestamp)-min(timestamp)',
        'count_if(event.type,equals,error)',
      ],
      orderby: '-min_timestamp',
      query: `(title:"sentry-replay-event-*" OR event.type:error) AND (${query})`,
    }),
    [query]
  );

  const {data} = useDiscoverQuery<ReplayDurationAndErrors>({discoverQuery});

  const dataEntries = data
    ? Object.fromEntries(data.map(item => [item.replayId, item]))
    : {};

  const replays = useMemo(() => {
    const replayIdMap = new Map();
    const list: Replay[] = [];
    for (const replay of replayList) {
      if (replay && !replayIdMap.has(replay.replayId)) {
        list.push(replay);
        replayIdMap.set(replay.replayId, true);
      }
    }
    return list;
  }, [replayList]);

  return (
    <Fragment>
      {replays.map(replay => (
        <Fragment key={replay.id}>
          <UserBadge
            avatarSize={32}
            displayName={
              <Link
                to={`/organizations/${organization.slug}/replays/${generateEventSlug({
                  project: replay.project,
                  id: replay[idKey],
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
          {isScreenLarge && showProjectColumn && (
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
              {isScreenLarge && <StyledIconCalendarWrapper color="gray500" size="sm" />}
              <TimeSince date={replay.timestamp} />
            </TimeSinceWrapper>
          </Item>
          {data ? (
            <React.Fragment>
              <Item>
                <Duration
                  seconds={
                    Math.floor(
                      dataEntries[replay[idKey]]
                        ? dataEntries[replay[idKey]]['equation[0]']
                        : 0
                    ) || 1
                  }
                  exact
                  abbreviation
                />
              </Item>
              <Item>
                {dataEntries[replay[idKey]]
                  ? dataEntries[replay[idKey]]?.count_if_event_type_equals_error
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
      ))}
    </Fragment>
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

export default ReplayTable;
