import type {ComponentProps} from 'react';
import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Alert} from 'sentry/components/core/alert';
import type {LinkButton} from 'sentry/components/core/button';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  analyticsContext: string;
  eventTimestampMs: number;
  orgSlug: string;
  replaySlug: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
};

function getReplayAnalyticsStatus({
  fetchError,
  replayRecord,
}: {
  fetchError?: RequestError;
  replayRecord?: ReplayRecord;
}) {
  if (fetchError) {
    return 'error';
  }

  if (replayRecord?.is_archived) {
    return 'archived';
  }

  if (replayRecord) {
    return 'success';
  }

  return 'none';
}

function ReplayPreview({
  analyticsContext,
  fullReplayButtonProps,
  eventTimestampMs,
  focusTab,
  orgSlug,
  replaySlug,
}: Props) {
  const {fetching, replay, replayRecord, fetchError, replayId} = useLoadReplayReader({
    orgSlug,
    replaySlug,
  });
  const organization = useOrganization();

  const startTimestampMs = replayRecord?.started_at?.getTime() ?? 0;
  const initialTimeOffsetMs = useMemo(() => {
    if (eventTimestampMs && startTimestampMs) {
      return Math.abs(eventTimestampMs - startTimestampMs);
    }

    return 0;
  }, [eventTimestampMs, startTimestampMs]);

  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({fetchError, replayRecord}),
  });

  useEffect(() => {
    if (fetchError) {
      trackAnalytics('replay.render-missing-replay-alert', {
        organization,
        surface: 'issue details - old preview',
      });
    }
  }, [organization, fetchError]);

  if (replayRecord?.is_archived) {
    return (
      <Alert.Container>
        <ArchivedReplayAlert message={t('The replay for this event has been deleted.')} />
      </Alert.Container>
    );
  }

  if (fetchError) {
    return <MissingReplayAlert orgSlug={orgSlug} />;
  }

  if (fetching || !replayRecord || !replay) {
    return (
      <StyledNegativeSpaceContainer data-test-id="replay-loading-placeholder">
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    );
  }

  return (
    <StaticReplayPreview
      focusTab={focusTab}
      isFetching={fetching}
      analyticsContext={analyticsContext}
      replay={replay}
      replayId={replayId}
      fullReplayButtonProps={fullReplayButtonProps}
      initialTimeOffsetMs={initialTimeOffsetMs}
    />
  );
}

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  margin-bottom: ${space(2)};
`;

export default ReplayPreview;
