import {useMemo} from 'react';
import countBy from 'lodash/countBy';

import useAllProjectVisibility from 'sentry/utils/project/useAllProjectVisibility';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayErrors: ReplayError[];
  replayRecord: ReplayRecord;
};

export default function useErrorCountPerProject({replayErrors, replayRecord}: Props) {
  const {getBySlug} = useAllProjectVisibility({});

  return useMemo(() => {
    return (
      Object.entries(countBy(replayErrors, 'project.name'))
        .map(([projectSlug, count]) => {
          return {project: getBySlug(projectSlug), count};
        })
        // sort to prioritize the replay errors first
        .sort(a => (a.project?.id !== replayRecord.project_id ? 1 : -1))
    );
  }, [getBySlug, replayErrors, replayRecord]);
}
