import {useEffect, useRef} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {isNotFoundError} from 'sentry/utils/requestError/requestError';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

interface Props {
  readerResult: ReturnType<typeof useLoadReplayReader>;
}

export function useLogEventReplayStatus({readerResult}: Props) {
  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({
      fetchError: readerResult.fetchError,
      replayRecord: readerResult.replayRecord,
    }),
  });
  const organization = useOrganization();

  const {fetchError, attachmentError} = readerResult;
  const hasError = Boolean(fetchError) || Boolean(attachmentError?.length);
  const is404 =
    isNotFoundError(fetchError) || Boolean(attachmentError?.some(isNotFoundError));

  const hasLoggedRef = useRef(false);
  const loggedIs404Ref = useRef(false);

  useEffect(() => {
    if (!hasError) {
      hasLoggedRef.current = false;
      loggedIs404Ref.current = false;
      return;
    }

    const shouldRefireForLate404 =
      hasLoggedRef.current && is404 && !loggedIs404Ref.current;

    if (!hasLoggedRef.current || shouldRefireForLate404) {
      hasLoggedRef.current = true;
      loggedIs404Ref.current = is404;
      trackAnalytics('replay.render-missing-replay-alert', {
        organization,
        surface: 'issue details - clip preview',
        is_404: is404,
      });
    }
  }, [organization, hasError, is404]);
}

function getReplayAnalyticsStatus({
  fetchError,
  replayRecord,
}: {
  fetchError?: Error;
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
