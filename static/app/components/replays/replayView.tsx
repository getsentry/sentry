import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentScreen from 'sentry/components/replays/replayCurrentScreen';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import TextCopyInput from 'sentry/components/textCopyInput';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX} from 'sentry/utils/replays/sdkVersions';
import {semverCompare} from 'sentry/utils/versions/semverCompare';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {JetpackComposePiiNotice} from 'sentry/views/replays/jetpackComposePiiNotice';

import {CanvasSupportNotice} from './canvasSupportNotice';

type Props = {
  isLoading: boolean;
  toggleFullscreen: () => void;
};

function ReplayView({toggleFullscreen, isLoading}: Props) {
  const isFullscreen = useIsFullscreen();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {isFetching, replay} = useReplayContext();
  const isVideoReplay = replay?.isVideoReplay();

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
                    size={'sm'}
                  />
                ) : null}
                <ScreenNameInputContainer>
                  <ReplayCurrentScreen />
                </ScreenNameInputContainer>
              </ScreenNameContainer>
            ) : (
              <ReplayCurrentUrl />
            )}
            <BrowserOSIcons showBrowser={!isVideoReplay} isLoading={isLoading} />
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
            <ReplayProcessingError processingErrors={replay.processingErrors()} />
          ) : (
            <FluidHeight>
              {isVideoReplay &&
              replay?.getReplay()?.sdk.name === 'sentry.java.android' &&
              semverCompare(
                replay?.getReplay()?.sdk.version || '',
                MIN_JETPACK_COMPOSE_VIEW_HIERARCHY_PII_FIX.minVersion
              ) === -1 ? (
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
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content;
  align-items: center;
  gap: ${space(1)};
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
  gap: 10px;
  flex-grow: 1;
`;

const BreadcrumbContainer = styled('div')`
  width: 25%;
`;

const PlayerBreadcrumbContainer = styled('div')`
  display: flex;
  flex-direction: row;
  height: 100%;
  gap: ${space(1)};
`;

export default ReplayView;
