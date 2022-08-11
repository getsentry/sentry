import {useCallback} from 'react';

import useProjects from 'sentry/utils/useProjects';
import type {ReplayRecord} from 'sentry/views/replays/types';

function useMapResponseToReplayRecord() {
  const {projects} = useProjects();

  return useCallback(
    (apiResponse: any): ReplayRecord =>
      ({
        ...apiResponse,
        // TODO(replays): replayId is temporary
        id: apiResponse.id || apiResponse.replayId,
        startedAt: new Date(apiResponse.startedAt),
        finishedAt: new Date(apiResponse.finishedAt),
        // TODO(replays): converting to String is temporary
        project: projects.find(project => project.id === String(apiResponse.projectId)),
        user: {
          ...apiResponse.user,
          // TODO(replays): ipAddress is temporary
          ip_address: apiResponse.user.ip_address || apiResponse.user.ipAddress,
        },
      } as ReplayRecord),
    [projects]
  );
}

export default useMapResponseToReplayRecord;
