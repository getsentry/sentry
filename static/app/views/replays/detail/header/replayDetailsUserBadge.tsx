import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {getReplayExpiresAtMs} from 'sentry/components/replays/replayLiveIndicator';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import {IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import usePollReplayRecord from 'sentry/utils/replays/hooks/usePollReplayRecord';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import useOrganization from 'sentry/utils/useOrganization';
import {useReplaySummaryContext} from 'sentry/views/replays/detail/ai/replaySummaryContext';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}
export default function ReplayDetailsUserBadge({readerResult}: Props) {
  const organization = useOrganization();
  const replayRecord = readerResult.replayRecord;

  const {slug: orgSlug} = organization;
  const replayId = readerResult.replayId;

  const queryClient = useQueryClient();
  const projectSlug = useReplayProjectSlug({replayRecord});
  const {startSummaryRequest} = useReplaySummaryContext();

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

  const badge = replayRecord ? (
    <Flex gap="md">
      <StyledReplaySessionColumn
        replay={replayRecord}
        rowIndex={0}
        columnIndex={0}
        showDropdownFilters={false}
      />
      <Button
        title={t('Replay is outdated. Refresh for latest activity.')}
        data-test-id="refresh-button"
        size="xs"
        onClick={handleRefresh}
        style={{visibility: showRefreshButton ? 'visible' : 'hidden'}}
      >
        <IconRefresh />
      </Button>
    </Flex>
  ) : null;

  return (
    <ReplayLoadingState
      readerResult={readerResult}
      renderArchived={() => null}
      renderError={() => null}
      renderThrottled={() => null}
      renderLoading={() =>
        replayRecord ? badge : <Placeholder width="251px" height="42px" />
      }
      renderMissing={() => null}
      renderProcessingError={() => badge}
    >
      {() => badge}
    </ReplayLoadingState>
  );
}

const StyledReplaySessionColumn = styled(ReplaySessionColumn.Component)`
  flex: 0;
`;
