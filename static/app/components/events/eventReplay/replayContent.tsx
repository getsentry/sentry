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
  orgSlug: string;
  replaySlug: string;
};

function ReplayContent({orgSlug, replaySlug}: Props) {
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();

  if (fetchError) {
    throw new Error('Failed to load Replay');
  }

  const replayRecord = replay?.getReplay();

  if (fetching || !replayRecord) {
    return <StyledPlaceholder height="400px" width="100%" />;
  }

  return (
    <table className="table key-value">
      <tbody>
        <tr key="replay">
          <td className="key">{t('Replay')}</td>
          <td className="value">
            <ReplayContextProvider replay={replay} initialTimeOffset={0}>
              <PlayerContainer ref={fullscreenRef}>
                <ReplayView toggleFullscreen={toggleFullscreen} showAddressBar={false} />
              </PlayerContainer>
            </ReplayContextProvider>
          </td>
        </tr>
        <tr key="id">
          <td className="key">{t('Id')}</td>
          <td className="value">
            <pre className="val-string">{replayRecord.id}</pre>
          </td>
        </tr>
        <tr key="url">
          <td className="key">{t('URL')}</td>
          <td className="value">
            <pre className="val-string">{replayRecord.urls[0]}</pre>
          </td>
        </tr>
        <tr key="timestamp">
          <td className="key">{t('Timestamp')}</td>
          <td className="value">
            <pre className="val-string">
              <DateTime year seconds utc date={replayRecord.startedAt} />
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
  );
}

const PlayerContainer = styled(FluidHeight)`
  margin-bottom: ${space(2)};
  background: ${p => p.theme.background};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-top: ${space(2)};
`;

export default ReplayContent;
