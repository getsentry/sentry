import {useEffect, useState} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import hydrateA11yIssue, {A11yIssue} from 'sentry/utils/replays/hydrateA11yRecord';
import useProjects from 'sentry/utils/useProjects';

export default function useA11yData() {
  const {replay} = useReplayContext();
  const {projects} = useProjects();

  const replayRecord = replay?.getReplay();
  const startTimestampMs = replayRecord?.started_at.getTime();
  const project = projects.find(p => p.id === replayRecord?.project_id);

  const [data, setData] = useState<undefined | A11yIssue[]>(undefined);
  useEffect(() => {
    if (startTimestampMs) {
      import('./mockA11yData').then(({A11yData}) => setData(A11yData(startTimestampMs)));
    }
  }, [startTimestampMs]);

  if (project && replayRecord && startTimestampMs) {
    return data?.map(record => hydrateA11yIssue(record));
  }
  return [];
}
