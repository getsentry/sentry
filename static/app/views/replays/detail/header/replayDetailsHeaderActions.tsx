import styled from '@emotion/styled';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ConfigureReplayCard from 'sentry/components/replays/header/configureReplayCard';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {space} from 'sentry/styles/space';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import ReplayItemDropdown from 'sentry/views/replays/detail/header/replayItemDropdown';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsHeaderActions({readerResult}: Props) {
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() => <Placeholder height="32px" width="352px" />}
      renderMissing={() => null}
      renderProcessingError={({replayRecord, projectSlug}) => (
        <ButtonActionsWrapper>
          <FeedbackButton size="xs" />
          <ConfigureReplayCard isMobile={false} replayRecord={replayRecord} />
          <ReplayItemDropdown
            projectSlug={projectSlug}
            replay={undefined}
            replayRecord={replayRecord}
          />
        </ButtonActionsWrapper>
      )}
    >
      {({replay}) => (
        <ButtonActionsWrapper>
          <FeedbackButton size="xs" />
          <ConfigureReplayCard
            isMobile={replay.isVideoReplay()}
            replayRecord={replay.getReplay()}
          />
          <ReplayItemDropdown
            projectSlug={readerResult.projectSlug}
            replay={replay}
            replayRecord={replay.getReplay()}
          />
        </ButtonActionsWrapper>
      )}
    </ReplayLoadingState>
  );
}

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  gap: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin-bottom: 0;
  }
`;
