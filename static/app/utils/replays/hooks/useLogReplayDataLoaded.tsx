import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type {BreadcrumbFrame} from 'sentry/utils/replays/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface Props
  extends Pick<
    ReturnType<typeof useLoadReplayReader>,
    'fetchError' | 'fetching' | 'projectSlug' | 'replay'
  > {}

function useLogReplayDataLoaded({fetchError, fetching, projectSlug, replay}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({
    organization,
    projectSlug: projectSlug ?? undefined,
  });

  useEffect(() => {
    if (fetching || fetchError || !replay || !project || replay.getReplay().is_archived) {
      return;
    }
    const replayRecord = replay.getReplay();
    const allErrors = replay.getErrorFrames();

    // BUG(replay): This will often report the discrepancy between errors
    // accociated with the replay, and errors the replay knows about.
    // ie: When an error is filtered server-side, it would count as a replay with 1
    // backend error.
    const feErrorIds = replayRecord.error_ids || [];
    const beErrorCount = allErrors.filter(
      error => !feErrorIds.includes(error.data.eventId)
    ).length;

    trackAnalytics('replay.details-data-loaded', {
      organization,
      be_errors: beErrorCount,
      fe_errors: feErrorIds.length,
      project_platform: project.platform!,
      replay_errors: 0,
      total_errors: allErrors.length,
      started_at_delta: replay.timestampDeltas.startedAtDelta,
      finished_at_delta: replay.timestampDeltas.finishedAtDelta,
      replay_id: replayRecord.id,
    });

    const hydrationErrorFrames = replay
      .getChapterFrames()
      .filter(frame => (frame as BreadcrumbFrame)?.category === 'replay.hydrate-error');
    if (hydrationErrorFrames.length > 0) {
      // Track when a hydration breadcrumb is present but unable to be viewed
      trackAnalytics('replay.details-has-hydration-error', {
        organization,
        num_errors: hydrationErrorFrames.length,
        replay_id: replayRecord.id,
      });
    }
  }, [organization, project, fetchError, fetching, projectSlug, replay]);
}

export default useLogReplayDataLoaded;
