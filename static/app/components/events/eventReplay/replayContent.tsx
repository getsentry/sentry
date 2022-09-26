import {useMemo} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import EventDataSection from 'sentry/components/events/eventDataSection';
import Placeholder from 'sentry/components/placeholder';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayView from 'sentry/components/replays/replayView';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  event: Event;
  orgSlug: string;
  replaySlug: string;
};

function ReplayContent({orgSlug, replaySlug, event}: Props) {
  const {fetching, replay, fetchError} = useReplayData({
    orgSlug,
    replaySlug,
  });
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();
  const eventTimestamp = event.dateCreated
    ? Math.floor(new Date(event.dateCreated).getTime() / 1000) * 1000
    : 0;

  if (fetchError) {
    throw new Error('Failed to load Replay');
  }

  const replayRecord = replay?.getReplay();

  const startTimestampMs = replayRecord?.startedAt.getTime() ?? 0;

  const initialTimeOffset = useMemo(() => {
    if (eventTimestamp && startTimestampMs) {
      return relativeTimeInMs(eventTimestamp, startTimestampMs) / 1000;
    }

    return 0;
  }, [eventTimestamp, startTimestampMs]);

  return (
    <EventDataSection
      type="replay"
      title={t('Replay')}
      actions={
        <Button
          size="sm"
          priority="primary"
          to={{
            pathname: `/organizations/${orgSlug}/replays/${replaySlug}/`,
            query: {
              t_main: 'console',
              f_c_search: undefined,
              ...(initialTimeOffset ? {t: initialTimeOffset} : {}),
            },
          }}
          data-test-id="replay-details-button"
        >
          {t('View Details')}
        </Button>
      }
    >
      {fetching || !replayRecord ? (
        <StyledPlaceholder
          testId="replay-loading-placeholder"
          height="400px"
          width="100%"
        />
      ) : (
        <table className="table key-value">
          <tbody>
            <tr key="replay">
              <td className="key">{t('Replay')}</td>
              <td className="value">
                <ReplayContextProvider
                  replay={replay}
                  initialTimeOffset={initialTimeOffset}
                >
                  <PlayerContainer ref={fullscreenRef} data-test-id="player-container">
                    <ReplayView
                      toggleFullscreen={toggleFullscreen}
                      showAddressBar={false}
                    />
                  </PlayerContainer>
                </ReplayContextProvider>
              </td>
            </tr>
            <tr key="id">
              <td className="key">{t('Id')}</td>
              <td className="value">
                <pre className="val-string" data-test-id="replay-id">
                  {replayRecord.id}
                </pre>
              </td>
            </tr>
            <tr key="url">
              <td className="key">{t('URL')}</td>
              <td className="value">
                <pre className="val-string" data-test-id="replay-url">
                  {replayRecord.urls[0]}
                </pre>
              </td>
            </tr>
            <tr key="timestamp">
              <td className="key">{t('Timestamp')}</td>
              <td className="value">
                <pre className="val-string" data-test-id="replay-timestamp">
                  <DateTime year seconds utc date={replayRecord.startedAt} />
                </pre>
              </td>
            </tr>
            <tr key="duration">
              <td className="key">{t('Duration')}</td>
              <td className="value">
                <pre className="val-string" data-test-id="replay-duration">
                  <Duration seconds={replayRecord.duration} fixedDigits={0} />
                </pre>
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </EventDataSection>
  );
}

const PlayerContainer = styled(FluidHeight)`
  margin-bottom: ${space(2)};
  background: ${p => p.theme.background};
  gap: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)`
  margin-top: ${space(2)};
`;

export default ReplayContent;
