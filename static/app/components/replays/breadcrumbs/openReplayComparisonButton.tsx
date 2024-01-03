import {Fragment, lazy, Suspense} from 'react';
import {css} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import ReplayReader from 'sentry/utils/replays/replayReader';
import useOrganization from 'sentry/utils/useOrganization';

const LazyComparisonModal = lazy(
  () => import('sentry/components/replays/breadcrumbs/replayComparisonModal')
);

interface Props {
  leftTimestamp: number;
  replay: null | ReplayReader;
  rightTimestamp: number;
}

export function OpenReplayComparisonButton({
  leftTimestamp,
  replay,
  rightTimestamp,
}: Props) {
  const organization = useOrganization();

  return (
    <Button
      role="button"
      size="xs"
      analyticsEventKey="replay.details-hydration-modal-opened"
      analyticsEventName="Replay Details Hydration Modal Opened"
      onClick={() => {
        openModal(
          deps => (
            <Suspense
              fallback={
                <Fragment>
                  <deps.Header closeButton>
                    <deps.Header>{t('Hydration Error')}</deps.Header>
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
                leftTimestamp={leftTimestamp}
                rightTimestamp={rightTimestamp}
                {...deps}
              />
            </Suspense>
          ),
          {modalCss}
        );
      }}
    >
      {t('Open Hydration Diff')}
    </Button>
  );
}

const modalCss = css`
  width: 95vw;
  min-height: 80vh;
  max-height: 95vh;
`;
