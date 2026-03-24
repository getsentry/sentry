import {useMemo} from 'react';

import type {Project} from 'sentry/types/project';
import type EventView from 'sentry/utils/discover/eventView';

export function useEventViewProject(
  projects: Project[],
  eventView: EventView,
  projectId = String(eventView.project[0])
) {
  return useMemo(
    () => projects.find(project => project.id === projectId),
    [projects, projectId]
  );
}
