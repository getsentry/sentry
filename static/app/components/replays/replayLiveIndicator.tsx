import {useCallback, useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import usePollReplayRecord from 'sentry/utils/replays/hooks/usePollReplayRecord';
import {useReplayProjectSlug} from 'sentry/utils/replays/hooks/useReplayProjectSlug';
import useOrganization from 'sentry/utils/useOrganization';
import useTimeout from 'sentry/utils/useTimeout';
import {useReplaySummaryContext} from 'sentry/views/replays/detail/ai/replaySummaryContext';
import type {ReplayRecord} from 'sentry/views/replays/types';

export const LIVE_TOOLTIP_MESSAGE = t('This replay is in progress.');

export function getReplayExpiresAtMs(startedAt: ReplayRecord['started_at']): number {
  const ONE_HOUR_MS = 3_600_000;
  return startedAt ? startedAt.getTime() + ONE_HOUR_MS : 0;
}

export function getLiveDurationMs(finishedAt: ReplayRecord['finished_at']): number {
  if (!finishedAt) {
    return 0;
  }
  const FIVE_MINUTE_MS = 300_000;
  return Math.max(finishedAt.getTime() + FIVE_MINUTE_MS - Date.now(), 0);
}

const pulse = keyframes`
  0% {
    transform: scale(0.1);
    opacity: 1
  }

  40%, 100% {
    transform: scale(1);
    opacity: 0;
  }
`;

export const LiveIndicator = styled('div')`
  background: ${p => p.theme.successText};
  height: 8px;
  width: 8px;
  position: relative;
  border-radius: 50%;
  margin-left: ${p => p.theme.space.sm};
  margin-right: ${p => p.theme.space.sm};

  @media (prefers-reduced-motion: reduce) {
    &:before {
      display: none;
    }
  }

  &:before {
    content: '';
    animation: ${pulse} 3s ease-out infinite;
    border: 6px solid ${p => p.theme.successText};
    position: absolute;
    border-radius: 50%;
    height: 20px;
    width: 20px;
    top: -6px;
    left: -6px;
  }
`;

interface UseLiveBadgeParams {
  finishedAt: ReplayRecord['finished_at'];
  startedAt: ReplayRecord['started_at'];
}

/**
 * Hook to determine if a replay is considered live
 */
export function useLiveBadge({startedAt, finishedAt}: UseLiveBadgeParams) {
  const [isLive, setIsLive] = useState(
    // We check for getLiveDurationMs to avoid a flicker.

    // There can exist a time where the replay hasn't expired (Date.now() < started_at + 1 hour), in which case the isLive would show True,
    // but the liveDuration is 0 (Date.now() > finished_at + 5 minutes), so the setTimeout, having a live duration of 0, would immediately
    // set isLive to false and cause this flicker
    Date.now() < getReplayExpiresAtMs(startedAt) && getLiveDurationMs(finishedAt) > 0
  );

  const {start: startTimeout} = useTimeout({
    timeMs: getLiveDurationMs(finishedAt),
    onTimeout: () => {
      setIsLive(false);
    },
  });

  useEffect(() => {
    startTimeout();
  }, [startTimeout]);

  return {
    isLive,
  };
}

/**
 *  Hook to handle loading new replay data and if a refresh button should be shown.
 */
export function useLiveRefresh({replay}: {replay: ReplayRecord | undefined}) {
  const organization = useOrganization();
  const {slug: orgSlug} = organization;
  const replayId = replay?.id;

  const queryClient = useQueryClient();
  const projectSlug = useReplayProjectSlug({replayRecord: replay});
  const {startSummaryRequest} = useReplaySummaryContext();
  const startSummaryRequestRef = useRef(startSummaryRequest);
  const isReplayExpired = Date.now() > getReplayExpiresAtMs(replay?.started_at ?? null);
  const polledReplayRecord = usePollReplayRecord({
    enabled: !isReplayExpired && Boolean(replayId),
    replayId: replayId ?? '', // empty is ok because `enabled` will be false above
    orgSlug,
  });
  startSummaryRequestRef.current = startSummaryRequest;

  const doRefresh = useCallback(async () => {
    trackAnalytics('replay.details-refresh-clicked', {organization});
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
    startSummaryRequestRef.current();
  }, [queryClient, orgSlug, projectSlug, replayId, organization]);

  const polledCountSegments = polledReplayRecord?.count_segments ?? 0;
  const prevSegments = replay?.count_segments ?? 0;
  const shouldShowRefreshButton = polledCountSegments > prevSegments;

  return {
    shouldShowRefreshButton,
    doRefresh,
  };
}
