import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useIsLive from 'sentry/utils/replays/hooks/useIsLive';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import usePollReplayRecord from 'sentry/utils/replays/hooks/usePollReplayRecord';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const organization = useOrganization();
  const replayRecord = readerResult.replayRecord;
  const replayReader = readerResult.replay;

  const {slug: orgSlug} = organization;
  const replayId = readerResult.replayId;
  const isLive = useIsLive({replayReader});
  const replayUpdated = usePollReplayRecord({
    isLive,
    replayId,
    orgSlug,
    replayReader,
  });
  // Generate search query based on available user data
  const getUserSearchQuery = () => {
    if (!replayRecord?.user) {
      return null;
    }

    const user = replayRecord.user;
    // Prefer email over id for search query
    if (user.email) {
      return `user.email:"${user.email}"`;
    }
    if (user.id) {
      return `user.id:"${user.id}"`;
    }
    return null;
  };

  const searchQuery = getUserSearchQuery();
  const userDisplayName = replayRecord?.user.display_name || t('Anonymous User');

  const handleRefresh = () => {
    window.location.reload();
  };

  const badge = replayRecord ? (
    <UserBadge
      avatarSize={24}
      displayName={
        <DisplayHeader>
          <Layout.Title>
            {searchQuery ? (
              <Link
                to={{
                  pathname: makeReplaysPathname({
                    path: '/',
                    organization,
                  }),
                  query: {
                    query: searchQuery,
                  },
                }}
              >
                {userDisplayName}
              </Link>
            ) : (
              userDisplayName
            )}
          </Layout.Title>
          {replayRecord.started_at ? (
            <TimeContainer>
              <IconCalendar color="gray300" size="xs" />
              <TimeSince
                date={replayRecord.started_at}
                isTooltipHoverable
                unitStyle="regular"
              />
              {isLive ? (
                <Tooltip
                  showUnderline
                  underlineColor="success"
                  title={t('This replay is still in progress.')}
                >
                  <Live />
                </Tooltip>
              ) : null}
              {replayUpdated ? (
                <RefreshButton
                  title={t('Replay is outdated. Refresh for latest activity.')}
                  size="xs"
                  onClick={handleRefresh}
                >
                  <IconRefresh />
                </RefreshButton>
              ) : null}
            </TimeContainer>
          ) : null}
        </DisplayHeader>
      }
      user={{
        name: replayRecord.user.display_name || '',
        email: replayRecord.user.email || '',
        username: replayRecord.user.username || '',
        ip_address: replayRecord.user.ip || '',
        id: replayRecord.user.id || '',
      }}
      hideEmail
    />
  ) : null;

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() =>
        replayRecord ? badge : <Placeholder width="30%" height="45px" />
      }
      renderMissing={() => null}
      renderProcessingError={() => badge}
    >
      {() => badge}
    </ReplayLoadingState>
  );
}

const TimeContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  height: ${p => p.theme.form.xs.height};
`;

const DisplayHeader = styled('div')`
  display: flex;
  flex-direction: column;
`;

function Live() {
  return (
    <Flex align="center">
      <LiveText bold>{t('LIVE')}</LiveText>
      <LiveIndicator />
    </Flex>
  );
}

const pulse = keyframes`
  0% {
    transform: scale(0.1);
    opacity: 1
  }

  40%, 100% {
    transform: scale(1);
    opacity: 0;
  }
`;

const LiveText = styled(Text)`
  color: ${p => p.theme.success};
`;

const LiveIndicator = styled('div')`
  background: ${p => p.theme.success};
  height: 8px;
  width: 8px;
  position: relative;
  border-radius: 50%;
  margin-left: 6px;

  @media (prefers-reduced-motion: reduce) {
    &:before {
      display: none;
    }
  }

  &:before {
    content: '';
    animation: ${pulse} 3s ease-out infinite;
    border: 6px solid ${p => p.theme.success};
    position: absolute;
    border-radius: 50%;
    height: 20px;
    width: 20px;
    top: -6px;
    left: -6px;
  }
`;

const RefreshButton = styled(Button)`
  margin-left: ${p => p.theme.space.md};
`;
