import {useMemo} from 'react';

import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface Props {
  replayRecord: ReplayRecord | undefined;
}

export function useReplayProjectSlug({replayRecord}: Props) {
  const projects = useProjects();
  return useMemo(() => {
    if (!replayRecord) {
      return null;
    }
    return projects.projects.find(p => p.id === replayRecord.project_id)?.slug ?? null;
  }, [replayRecord, projects]);
}
