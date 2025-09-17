import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const replayRecord = readerResult.replayRecord;
  const replay = readerResult.replay;
  const badge = replayRecord ? (
    <UserBadge
      avatarSize={24}
      displayName={
        <DisplayHeader>
          <Layout.Title>
            {replayRecord.user.display_name || t('Anonymous User')}
          </Layout.Title>
          {replayRecord.started_at ? (
            <TimeContainer>
              <IconCalendar color="gray300" size="xs" />
              <TimeSince
                date={replayRecord.started_at}
                isTooltipHoverable
                unitStyle="regular"
              />
              {replay?.getIsLive() ? <Live /> : null}
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
  line-height: 1.4;
`;

const DisplayHeader = styled('div')`
  display: flex;
  flex-direction: column;
`;

function Live() {
  return (
    <Flex align="center">
      <LiveText>{t('LIVE')}</LiveText>
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

const LiveText = styled('span')`
  color: ${p => p.theme.success};
`;

const LiveIndicator = styled('div')`
  background: ${p => p.theme.success};
  height: 8px;
  width: 8px;
  position: relative;
  border-radius: 50%;
  margin-left: 6px;

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
