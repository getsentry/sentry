import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

export function useFeatureFilter(
  project: Project,
  settingsKey: string,
  successMessage: string
) {
  const updateProject = useUpdateProject(project);

  const filterQuery = String(project.options?.[settingsKey] ?? '');

  const setFilterQuery = useCallback(
    (query: string) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {
          options: {[settingsKey]: query},
        },
        {
          onSuccess: () => {
            addSuccessMessage(successMessage);
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject, settingsKey, successMessage]
  );

  return [filterQuery, setFilterQuery] as const;
}
