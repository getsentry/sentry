import {Fragment, lazy, type ReactNode, Suspense} from 'react';
import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button, type ButtonProps} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

const LazyComparisonModal = lazy(
  () => import('sentry/components/replays/breadcrumbs/replayComparisonModal')
);

interface Props {
  children: ReactNode;
  leftOffsetMs: number;
  replay: null | ReplayReader;
  rightOffsetMs: number;
  surface: string;
  size?: ButtonProps['size'];
}

export function OpenReplayComparisonButton({
  children,
  leftOffsetMs,
  replay,
  rightOffsetMs,
  surface,
  size,
}: Props) {
  const organization = useOrganization();

  return (
    <Button
      role="button"
      size={size}
      analyticsEventKey="replay.hydration-modal.opened"
      analyticsEventName="Hydration Modal Opened"
      analyticsParams={{surface, organization}}
      onClick={event => {
        event.stopPropagation();
        openModal(
          deps => (
            <Suspense
              fallback={
                <Fragment>
                  <deps.Header closeButton>
                    <deps.Header>
                      <h4>
                        Hydration Error
                        <FeatureBadge type="beta" />
                      </h4>
                    </deps.Header>
                  </deps.Header>
                  <deps.Body>
                    <LoadingIndicator />
                  </deps.Body>
                </Fragment>
              }
            >
              <LazyComparisonModal
                replay={replay}
                organization={organization}
                leftOffsetMs={leftOffsetMs}
                rightOffsetMs={rightOffsetMs}
                {...deps}
              />
            </Suspense>
          ),
          {modalCss}
        );
      }}
    >
      {children}
    </Button>
  );
}

const modalCss = css`
  width: 95vw;
  min-height: 80vh;
  max-height: 95vh;
`;
