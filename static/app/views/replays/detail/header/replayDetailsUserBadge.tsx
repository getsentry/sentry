import styled from '@emotion/styled';

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
