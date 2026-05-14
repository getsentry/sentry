import {Fragment} from 'react';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {Placeholder} from 'sentry/components/placeholder';
import {ConfigureReplayCard} from 'sentry/components/replays/header/configureReplayCard';
import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import {t} from 'sentry/locale';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {ReplayItemDropdown} from 'sentry/views/explore/replays/detail/header/replayItemDropdown';
import {TopBar} from 'sentry/views/navigation/topBar';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function ReplayDetailsHeaderActions({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() => (
        <TopBar.Slot name="actions">
          <Placeholder height="32px" width="352px" />
        </TopBar.Slot>
      )}
      renderMissing={() => null}
      renderProcessingError={({replayRecord, projectSlug}) => (
        <Fragment>
          <TopBar.Slot name="actions">
            <ConfigureReplayCard isMobile={false} replayRecord={replayRecord} />
            <ReplayItemDropdown
              projectSlug={projectSlug}
              replay={undefined}
              replayRecord={replayRecord}
            />
          </TopBar.Slot>
          <TopBar.Slot name="feedback">
            <FeedbackButton
              aria-label={t('Give Feedback')}
              tooltipProps={{title: t('Give Feedback')}}
            >
              {null}
            </FeedbackButton>
          </TopBar.Slot>
        </Fragment>
      )}
    >
      {({replay}) => (
        <Fragment>
          <TopBar.Slot name="actions">
            <ConfigureReplayCard
              isMobile={replay.isVideoReplay()}
              replayRecord={replay.getReplay()}
            />
            <ReplayItemDropdown
              projectSlug={readerResult.projectSlug}
              replay={replay}
              replayRecord={replay.getReplay()}
            />
          </TopBar.Slot>
          <TopBar.Slot name="feedback">
            <FeedbackButton
              aria-label={t('Give Feedback')}
              tooltipProps={{title: t('Give Feedback')}}
            >
              {null}
            </FeedbackButton>
          </TopBar.Slot>
        </Fragment>
      )}
    </ReplayLoadingState>
  );
}
