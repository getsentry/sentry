import {useMemo} from 'react';
import styled from '@emotion/styled';
import RRWebPlayer from 'rrweb-player';

import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import space from 'sentry/styles/space';
import {Event, EventTransaction} from 'sentry/types/event';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import RRWebEventReader from 'sentry/utils/replays/rrwebEventReader';

type RRWebEvents = ConstructorParameters<typeof RRWebPlayer>[0]['props']['events'];

interface Props {
  event: Event;
  className?: string;
  events?: RRWebEvents;
}

function ReplayRRWebPlayer({event, events, className}: Props) {
  const basicReplay = useMemo(
    () => RRWebEventReader.build(event as EventTransaction, events),
    [event, events]
  );

  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();

  events?.sort((a, b) => a.timestamp - b.timestamp);
  const duration = events ? events[events.length - 1].timestamp - events[0].timestamp : 0;

  return (
    <ReplayContextProvider replay={basicReplay} value={{duration}}>
      <PanelNoMargin
        className={className}
        isFullscreen={isFullscreen}
        ref={fullscreenRef}
      >
        <PanelHeader>
          <ReplayPlayer />
        </PanelHeader>
        <PanelBody withPadding>
          <ScrubberSpacer>
            <PlayerScrubber />
          </ScrubberSpacer>
          <ReplayController toggleFullscreen={toggleFullscreen} />
        </PanelBody>
      </PanelNoMargin>
    </ReplayContextProvider>
  );
}

const PanelNoMargin = styled(Panel)<{isFullscreen: boolean}>`
  margin-bottom: 0;

  ${p =>
    p.isFullscreen
      ? `height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      `
      : ''}
`;

const PanelHeader = styled(_PanelHeader)<{noBorder?: boolean}>`
  display: block;
  padding: 0;
  ${p => (p.noBorder ? 'border-bottom: none;' : '')}
`;

const ScrubberSpacer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default ReplayRRWebPlayer;
