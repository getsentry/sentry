import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

export type PreprodEnabledWriteKey =
  | 'preprodSizeEnabledByCustomer'
  | 'preprodDistributionEnabledByCustomer';

interface UseFeatureFilterOptions {
  enabledReadKey: string;
  enabledWriteKey: PreprodEnabledWriteKey;
  project: Project;
  queryReadKey: string;
  queryWriteKey: string;
  successMessage: string;
}

interface UseFeatureFilterResult {
  enabled: boolean;
  filterQuery: string;
  setEnabled: (enabled: boolean) => void;
  setFilterQuery: (query: string) => void;
}

export function useFeatureFilter({
  project,
  queryReadKey,
  queryWriteKey,
  enabledReadKey,
  enabledWriteKey,
  successMessage,
}: UseFeatureFilterOptions): UseFeatureFilterResult {
  const updateProject = useUpdateProject(project);

  const filterQuery = String(project.options?.[queryReadKey] ?? '');
  const enabled: boolean =
    (project[enabledWriteKey] ?? project.options?.[enabledReadKey]) !== false;

  const setFilterQuery = useCallback(
    (query: string) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {
          [queryWriteKey]: query === '' ? null : query,
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
    [updateProject, queryWriteKey, successMessage]
  );

  const setEnabled = useCallback(
    (newEnabled: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {
          [enabledWriteKey]: newEnabled,
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
    [updateProject, enabledWriteKey, successMessage]
  );

  return {filterQuery, setFilterQuery, enabled, setEnabled};
}
