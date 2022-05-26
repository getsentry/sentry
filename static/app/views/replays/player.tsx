import styled from '@emotion/styled';

import RRWebIntegration from 'sentry/components/events/rrwebIntegration';
import * as Layout from 'sentry/components/layouts/thirds';
import {Panel, PanelBody, PanelHeader as _PanelHeader} from 'sentry/components/panels';
import {PlayerScrubber} from 'sentry/components/replays/player/scrubber';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import space from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import useEvent from 'sentry/utils/replays/hooks/useEvent';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useReplayData from 'sentry/utils/replays/hooks/useReplayData';
import {useRouteContext} from 'sentry/utils/useRouteContext';

function Player() {
  return (
    <Layout.Body>
      <OrigRRWeb />
      <NewReplay />
    </Layout.Body>
  );
}

function OrigRRWeb() {
  const {
    params: {eventSlug, orgId},
  } = useRouteContext();
  const [projectId, _] = eventSlug.split(':');

  const {data: event} = useEvent<Event>({orgId, eventSlug});

  if (!event) {
    return <div>Loading...</div>;
  }

  return (
    <Layout.Main>
      <EventDataSection>
        <RRWebIntegration
          event={event}
          orgId={orgId}
          projectId={projectId}
          renderer={children => children}
        />
      </EventDataSection>
    </Layout.Main>
  );
}

const EventDataSection = styled('div')`
  overflow: hidden;

  display: flex;
  flex-direction: column;
  border-top: 1px solid ${p => p.theme.innerBorder};
  margin: 0;

  position: relative;
`;

function NewReplay() {
  const {
    params: {eventSlug, orgId},
  } = useRouteContext();

  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();

  const {replay} = useReplayData({
    eventSlug,
    orgId,
  });

  if (!replay) {
    return <div>Loading...</div>;
  }

  return (
    <Layout.Main>
      <ReplayContextProvider replay={replay}>
        <PanelNoMargin isFullscreen={isFullscreen} ref={fullscreenRef}>
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
    </Layout.Main>
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

export default Player;
