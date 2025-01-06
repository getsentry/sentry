import {Fragment, lazy, type ReactNode, Suspense} from 'react';
import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button, type ButtonProps} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

const LazyComparisonModal = lazy(
  () => import('sentry/components/replays/breadcrumbs/replayComparisonModal')
);

interface Props {
  children: ReactNode;
  leftOffsetMs: number;
  replay: ReplayReader;
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
                      <h4>{t('Hydration Error')}</h4>
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
                initialLeftOffsetMs={leftOffsetMs}
                initialRightOffsetMs={rightOffsetMs}
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
  /* Swap typical modal margin and padding
   * We want a minimal space around the modal (hence, 30px 16px)
   * But this space should also be clickable, so it's not the padding.
   */
  margin: 30px 16px !important;
  padding: 0 !important;
  height: calc(100% - 60px);
  width: calc(100% - 32px);
  display: flex;
  & > * {
    flex-grow: 1;
    display: grid;
    grid-template-rows: max-content 1fr;
  }
`;
