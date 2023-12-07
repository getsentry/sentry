import {useMemo} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import {useQuery} from 'sentry/utils/queryClient';
import hydrateA11yFrame, {RawA11yResponse} from 'sentry/utils/replays/hydrateA11yFrame';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

export default function useA11yData() {
  const api = useApi();
  const organization = useOrganization();
  const {currentTime, replay} = useReplayContext();
  const {projects} = useProjects();
  const replayRecord = replay?.getReplay();
  const startTimestampMs = replayRecord?.started_at.getTime();
  const project = projects.find(p => p.id === replayRecord?.project_id);
  const unixTimestamp = ((startTimestampMs || 0) + currentTime) / 1000;
  const {data, ...rest} = useQuery<RawA11yResponse>({
    queryKey: [
      `/projects/${organization.slug}/${project?.slug}/replays/${replayRecord?.id}/accessibility-issues/`,
    ],
    queryFn: ({queryKey: [url]}) =>
      api.requestPromise(String(url), {
        method: 'GET',
        query: {timestamp: unixTimestamp},
      }),
    staleTime: 0,
    enabled: Boolean(project) && Boolean(replayRecord),
  });

  const hydrated = useMemo(
    () => data?.data?.flatMap(record => hydrateA11yFrame(record, startTimestampMs ?? 0)),
    [data?.data, startTimestampMs]
  );
  return {data: hydrated, dataOffsetMs: currentTime, ...rest};
}
