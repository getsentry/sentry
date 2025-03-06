import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton, type LinkButtonProps} from 'sentry/components/button';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';

type StaticReplayPreviewProps = {
  analyticsContext: string;
  initialTimeOffsetMs: number;
  isFetching: boolean;
  replay: ReplayReader | null;
  replayId: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<Omit<LinkButtonProps, 'external'>>;
};

export function StaticReplayPreview({
  analyticsContext,
  initialTimeOffsetMs,
  isFetching,
  focusTab,
  replayId,
  fullReplayButtonProps,
  replay,
}: StaticReplayPreviewProps) {
  const organization = useOrganization();
  const routes = useRoutes();
  const fullReplayUrl = {
    pathname: makeReplaysPathname({
      path: `/${replayId}/`,
      organization,
    }),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: focusTab ?? TabKey.ERRORS,
      t: initialTimeOffsetMs / 1000,
    },
  };

  const offset = useMemo(
    () => ({
      offsetMs: initialTimeOffsetMs,
    }),
    [initialTimeOffsetMs]
  );

  return (
    <ReplayContextProvider
      analyticsContext={analyticsContext}
      initialTimeOffsetMs={offset}
      isFetching={isFetching}
      replay={replay}
    >
      <PlayerContainer data-test-id="player-container">
        {replay?.hasProcessingErrors() ? (
          <ReplayProcessingError processingErrors={replay.processingErrors()} />
        ) : (
          <Fragment>
            <StaticPanel>
              <ReplayPlayer isPreview />
            </StaticPanel>

            <CTAOverlay>
              <LinkButton
                {...fullReplayButtonProps}
                icon={<IconPlay />}
                priority="primary"
                to={fullReplayUrl}
              >
                {t('Open Replay')}
              </LinkButton>
            </CTAOverlay>
          </Fragment>
        )}
      </PlayerContainer>
    </ReplayContextProvider>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  background: ${p => p.theme.background};
  gap: ${space(1)};
  max-height: ${REPLAY_LOADING_HEIGHT + 16}px;
`;

const StaticPanel = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const CTAOverlay = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.5);
`;
