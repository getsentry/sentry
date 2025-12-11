import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import ConfigureReplayCard from 'sentry/components/replays/header/configureReplayCard';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {getReplayExpiresAtMs} from 'sentry/components/replays/replayLiveIndicator';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import usePollReplayRecord from 'sentry/utils/replays/hooks/usePollReplayRecord';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import useOrganization from 'sentry/utils/useOrganization';
import {useReplaySummaryContext} from 'sentry/views/replays/detail/ai/replaySummaryContext';
import ReplayItemDropdown from 'sentry/views/replays/detail/header/replayItemDropdown';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function ReplayDetailsHeaderActions({readerResult}: Props) {
  const organization = useOrganization();
  const {slug: orgSlug} = organization;
  const replayId = readerResult.replayId;
  const replayRecord = readerResult.replayRecord;
  const queryClient = useQueryClient();
  const projectSlug = useReplayProjectSlug({replayRecord});
  const {startSummaryRequest} = useReplaySummaryContext();

  const isReplayExpired =
    Date.now() > getReplayExpiresAtMs(replayRecord?.started_at ?? null);

  const polledReplayRecord = usePollReplayRecord({
    enabled: !isReplayExpired,
    replayId,
    orgSlug,
  });

  const polledCountSegments = polledReplayRecord?.count_segments ?? 0;
  const prevSegments = replayRecord?.count_segments ?? 0;

  const showRefreshButton = polledCountSegments > prevSegments;

  const handleRefresh = async () => {
    trackAnalytics('replay.details-refresh-clicked', {organization});
    if (organization.features.includes('replay-refresh-background')) {
      await queryClient.refetchQueries({
        queryKey: [`/organizations/${orgSlug}/replays/${replayId}/`],
        exact: true,
        type: 'all',
      });
      await queryClient.invalidateQueries({
        queryKey: [
          `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/recording-segments/`,
        ],
        type: 'all',
      });
      startSummaryRequest();
    } else {
      window.location.reload();
    }
  };
  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() => <Placeholder height="33px" width="203px" />}
      renderMissing={() => null}
      renderProcessingError={() => (
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
          <Button
            title={t('Replay is outdated. Refresh for latest activity.')}
            data-test-id="refresh-button"
            size="xs"
            onClick={handleRefresh}
            icon={<IconRefresh />}
            style={{visibility: showRefreshButton ? 'visible' : 'hidden'}}
          >
            {t('Refresh')}
          </Button>
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
