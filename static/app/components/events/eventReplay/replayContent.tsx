import {Fragment} from 'react';
import styled from '@emotion/styled';

import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  eventSlug: string;
  orgId: string;
};

function ReplayContent({eventSlug, orgId}: Props) {
  const {fetching, replay, fetchError} = useReplayData({
    eventSlug,
    orgId,
  });
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();

  const replayRecord = replay?.getReplay();
  const replayEvent = replay?.getEvent();

  if (fetchError) {
    throw new Error('Failed to load Replay');
  }

  if (fetching || !replayRecord || !replayEvent) {
    return <StyledPlaceholder height="400px" width="100%" />;
  }

  return (
    <Fragment>
      <ReplayContextProvider replay={replay} initialTimeOffset={0}>
        <PlayerContainer ref={fullscreenRef}>
          <ReplayView toggleFullscreen={toggleFullscreen} />
        </PlayerContainer>
      </ReplayContextProvider>
      <table className="table key-value">
        <tbody>
          <tr key="id">
            <td className="key">{t('Id')}</td>
            <td className="value">
              <pre className="val-string">{replayRecord.replay_id}</pre>
            </td>
          </tr>
          <tr key="url">
            <td className="key">{t('URL')}</td>
            <td className="value">
              <pre className="val-string">{replayEvent.culprit}</pre>
            </td>
          </tr>
          <tr key="timestamp">
            <td className="key">{t('Timestamp')}</td>
            <td className="value">
              <pre className="val-string">
                <DateTime
                  format="MMM D, YYYY HH:mm:ss zz"
                  date={replayRecord.started_at}
                />
              </pre>
            </td>
          </tr>
          <tr key="duration">
            <td className="key">{t('Duration')}</td>
            <td className="value">
              <pre className="val-string">
                <Duration seconds={replayRecord.duration / 1000} fixedDigits={0} />
              </pre>
            </td>
          </tr>
        </tbody>
      </table>
    </Fragment>
  );
}

const PlayerContainer = styled(FluidHeight)`
  max-width: 420px;
  margin-bottom: ${space(2)};

  background: ${p => p.theme.background};
  gap: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-top: ${space(2)};
`;

export default ReplayContent;
