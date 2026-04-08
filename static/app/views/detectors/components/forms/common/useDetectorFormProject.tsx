import {useMemo} from 'react';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

export function useDetectorFormProject(): Project {
  const projectId = useFormField<string>('projectId');
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === projectId),
    [projects, projectId]
  );
  // There's a top-level spinner when projects are loading, and you can't select a
  // project that's not in the ProjectStore, so this should never happen.
  if (!project) {
    throw new Error(
      `useDetectorFormProject: no project found for projectId "${projectId}"`
    );
  }
  return project;
}
