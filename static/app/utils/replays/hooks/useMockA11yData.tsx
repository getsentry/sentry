import {useEffect, useState} from 'react';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import hydrateA11yFrame, {RawA11yFrame} from 'sentry/utils/replays/hydrateA11yFrame';
import useProjects from 'sentry/utils/useProjects';

export default function useA11yData() {
  const {replay} = useReplayContext();
  const {projects} = useProjects();

  const replayRecord = replay?.getReplay();
  const startTimestampMs = replayRecord?.started_at.getTime();
  const project = projects.find(p => p.id === replayRecord?.project_id);

  const [data, setData] = useState<undefined | RawA11yFrame[]>(undefined);
  useEffect(() => {
    if (startTimestampMs) {
      import('./mockA11yData').then(({A11yData}) => setData(A11yData(startTimestampMs)));
    }
  }, [startTimestampMs]);

  if (project && replayRecord && startTimestampMs) {
    return data?.map(record => hydrateA11yFrame(record));
  }
  return [];
}
