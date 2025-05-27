import styled from '@emotion/styled';

import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ConfigureReplayCard from 'sentry/components/replays/configureReplayCard';
import ConfigureMobileReplayCard from 'sentry/components/replays/header/configureMobileReplayCard';
import FeedbackButton from 'sentry/components/replays/header/feedbackButton';
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
      renderLoading={() => <Placeholder height="33px" width="203px" />}
      renderMissing={() => null}
      renderProcessingError={({replayRecord, projectSlug}) => (
        <ButtonActionsWrapper>
          <FeedbackButton />
          <ConfigureReplayCard />
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
          {replay.isVideoReplay() ? <FeedbackWidgetButton /> : <FeedbackButton />}
          {replay.isVideoReplay() ? (
            <ConfigureMobileReplayCard replayRecord={replay.getReplay()} />
          ) : (
            <ConfigureReplayCard />
          )}
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
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;
