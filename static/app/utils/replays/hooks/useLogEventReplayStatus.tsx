import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export default function useLogEventReplayStatus({readerResult}: Props) {
  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({
      fetchError: readerResult.fetchError,
      replayRecord: readerResult.replayRecord,
    }),
  });
  const organization = useOrganization();

  useEffect(() => {
    if (readerResult.fetchError) {
      trackAnalytics('replay.render-missing-replay-alert', {
        organization,
        surface: 'issue details - clip preview',
      });
    }
  }, [organization, readerResult.fetchError]);
}

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
