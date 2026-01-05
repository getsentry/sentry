import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {
  getLiveDurationMs,
  getReplayExpiresAtMs,
  LIVE_TOOLTIP_MESSAGE,
  LiveIndicator,
  useLiveRefresh,
} from 'sentry/components/replays/replayLiveIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const organization = useOrganization();
  const replayRecord = readerResult.replayRecord;
  const {shouldShowRefreshButton, doRefresh} = useLiveRefresh({replay: replayRecord});

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

  const isReplayExpired =
    Date.now() > getReplayExpiresAtMs(replayRecord?.started_at ?? null);

  const showLiveIndicator =
    !isReplayExpired && replayRecord && getLiveDurationMs(replayRecord.finished_at) > 0;

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
              {showLiveIndicator ? (
                <Tooltip
                  title={LIVE_TOOLTIP_MESSAGE}
                  underlineColor="success"
                  showUnderline
                >
                  <Flex align="center">
                    <Text bold variant="success" data-test-id="live-badge">
                      {t('LIVE')}
                    </Text>
                    <LiveIndicator />
                  </Flex>
                </Tooltip>
              ) : null}
              <Button
                title={t('Replay is outdated. Refresh for latest activity.')}
                data-test-id="refresh-button"
                size="xs"
                onClick={doRefresh}
                style={{visibility: shouldShowRefreshButton ? 'visible' : 'hidden'}}
              >
                <IconRefresh />
              </Button>
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
        replayRecord ? badge : <Placeholder width="30%" height="68px" />
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
  line-height: 1.4;
`;

const DisplayHeader = styled('div')`
  display: flex;
  flex-direction: column;
`;
