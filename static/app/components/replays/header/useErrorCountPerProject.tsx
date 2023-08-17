import {useMemo} from 'react';
import countBy from 'lodash/countBy';

import useProjects from 'sentry/utils/useProjects';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord;
};

export default function useErrorCountByProject({replayErrors, replayRecord}: Props) {
  const {projects} = useProjects();

  return useMemo(() => {
    return (
      Object.entries(countBy(replayErrors, 'project.name'))
        .map(([projectSlug, count]) => {
          const project = projects.find(p => p.slug === projectSlug);
          return {project, count};
        })
        // sort to prioritize the replay errors first
        .sort(a => (a.project?.id !== replayRecord.project_id ? 1 : -1))
    );
  }, [projects, replayErrors, replayRecord]);
}
