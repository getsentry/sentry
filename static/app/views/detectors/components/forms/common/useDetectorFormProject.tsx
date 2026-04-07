import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import type {Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

/**
 * Returns the current project based on the form's `projectId` field.
 * Reactively updates when the user changes the project in the form.
 *
 * Must be used within a Form that has a `projectId` field.
 */
export function useDetectorFormProject(): Project {
  const projectId = useFormField<string>('projectId');
  const {projects} = useProjects();
  const project = projects.find(p => p.id === projectId);
  if (!project) {
    throw new Error(
      `useDetectorFormProject: no project found for projectId "${projectId}"`
    );
  }
  return project;
}
