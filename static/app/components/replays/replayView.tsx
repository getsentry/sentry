import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {CanvasSupportNotice} from 'sentry/components/replays/canvasSupportNotice';
import {
  JetpackComposePiiNotice,
  useNeedsJetpackComposePiiNotice,
} from 'sentry/components/replays/jetpackComposePiiNotice';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentScreen from 'sentry/components/replays/replayCurrentScreen';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconFatal} from 'sentry/icons/iconFatal';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import ReplayViewScale from 'sentry/views/replays/detail/replayViewScale';

type Props = {
  isLoading: boolean;
  toggleFullscreen: () => void;
};

function FatalIconTooltip({error}: {error: Error | null}) {
  return (
    <Tooltip skipWrapper title={error?.message}>
      <IconFatal size="sm" />
    </Tooltip>
  );
}

export default function ReplayView({toggleFullscreen, isLoading}: Props) {
  const isFullscreen = useIsFullscreen();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const replay = useReplayReader();
  const {isFetching} = useReplayContext();
  const isVideoReplay = replay?.isVideoReplay();
  const needsJetpackComposePiiWarning = useNeedsJetpackComposePiiNotice({
    replays: replay ? [replay.getReplay()] : [],
  });

  return (
    <Fragment>
      <PlayerBreadcrumbContainer>
        <PlayerContainer>
          <ContextContainer>
            {isLoading ? (
              <TextCopyInput size="sm" disabled>
                {''}
              </TextCopyInput>
            ) : isVideoReplay ? (
              <ScreenNameContainer>
                {replay?.getReplay()?.sdk.name?.includes('flutter') ? (
                  <QuestionTooltip
                    isHoverable
                    title={tct(
                      'In order to see the correct screen name, you need to configure the [link:Sentry Routing Instrumentation].',
                      {
                        link: (
                          <ExternalLink href="https://docs.sentry.io/platforms/dart/guides/flutter/integrations/routing-instrumentation/" />
                        ),
                      }
                    )}
                    size="sm"
                  />
                ) : null}
                <ScreenNameInputContainer>
                  <ReplayCurrentScreen />
                </ScreenNameInputContainer>
              </ScreenNameContainer>
            ) : (
              <ReplayCurrentUrl />
            )}

            <ErrorBoundary customComponent={FatalIconTooltip}>
              <BrowserOSIcons showBrowser={!isVideoReplay} isLoading={isLoading} />
            </ErrorBoundary>
            <ErrorBoundary customComponent={FatalIconTooltip}>
              <ReplayViewScale isLoading={isLoading} />
            </ErrorBoundary>
            {isFullscreen ? (
              <ReplaySidebarToggleButton
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
              />
            ) : null}
          </ContextContainer>
          {isLoading ? (
            <FluidHeight>
              <Panel>
                <NegativeSpaceContainer />
              </Panel>
            </FluidHeight>
          ) : !isFetching && replay?.hasProcessingErrors() ? (
            <ReplayProcessingError />
          ) : (
            <FluidHeight>
              {isVideoReplay && needsJetpackComposePiiWarning ? (
                <JetpackComposePiiNotice />
              ) : null}
              <CanvasSupportNotice />
              <Panel>
                <ReplayPlayer inspectable />
              </Panel>
            </FluidHeight>
          )}
        </PlayerContainer>
        {isFullscreen && isSidebarOpen ? (
          <BreadcrumbContainer>
            <Breadcrumbs />
          </BreadcrumbContainer>
        ) : null}
      </PlayerBreadcrumbContainer>
      {isFullscreen ? (
        <ReplayController
          isLoading={isLoading}
          toggleFullscreen={toggleFullscreen}
          hideFastForward={isVideoReplay}
        />
      ) : null}
    </Fragment>
  );
}

const Panel = styled(FluidHeight)`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(1.5)};
`;

const ScreenNameContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  width: 100%;
  flex: 1;
`;

const ScreenNameInputContainer = styled('div')`
  flex: 1;
  width: 100%;
`;

const PlayerContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-template-rows: auto 1fr;
  gap: ${space(1)};
  flex-grow: 1;
`;

const BreadcrumbContainer = styled('div')`
  display: flex;
  width: 25%;

  & > div {
    flex-grow: 1;
  }
`;

const PlayerBreadcrumbContainer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  gap: ${space(1)};
`;
