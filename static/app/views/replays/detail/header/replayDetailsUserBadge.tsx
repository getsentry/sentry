import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Flex} from 'sentry/components/core/layout';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
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
        <Flex align="center">
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
                {replay?.getIsActive() ? <Live /> : null}
              </TimeContainer>
            ) : null}
          </DisplayHeader>
        </Flex>
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
    <LiveContainer align="center">
      <span>{t('LIVE')}</span>
      <LiveIndicator />
    </LiveContainer>
  );
}

const LiveContainer = styled(Flex)`
  line-height: 1;
  margin-top: 1px;
`;

const LiveIndicator = styled(motion.div)`
  margin-left: 6px;
  --pulsingIndicatorRing: ${p => p.theme.success};
  ${pulsingIndicatorStyles};
  &:before {
    height: 40px;
    width: 40px;
    top: -16px;
    left: -16px;
  }
  background-color: ${p => p.theme.success};
`;
