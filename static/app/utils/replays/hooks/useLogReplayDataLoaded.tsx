import {useEffect} from 'react';

import {trackAnalytics} from 'sentry/utils/analytics';
import type useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface Props
  extends Pick<
    ReturnType<typeof useReplayReader>,
    'fetchError' | 'fetching' | 'projectSlug' | 'replay'
  > {}

function useLogReplayDataLoaded({fetchError, fetching, projectSlug, replay}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({
    organization,
    projectSlug: projectSlug ?? undefined,
  });

  useEffect(() => {
    if (fetching || fetchError || !replay || !project) {
      return;
    }
    const feErrorIds = replay.getReplay().error_ids || [];
    const allErrors = replay.getRawErrors();
    const beErrorCount = allErrors.filter(error => !feErrorIds.includes(error.id)).length;

    trackAnalytics('replay.details-data-loaded', {
      organization,
      be_errors: beErrorCount,
      fe_errors: feErrorIds.length,
      project_platform: project.platform!,
      replay_errors: 0,
      total_errors: allErrors.length,
      started_at_delta: replay.timestampDeltas.startedAtDelta,
      finished_at_delta: replay.timestampDeltas.finishedAtDelta,
      replay_id: replay.getReplay().id,
    });
  }, [organization, project, fetchError, fetching, projectSlug, replay]);
}

export default useLogReplayDataLoaded;
