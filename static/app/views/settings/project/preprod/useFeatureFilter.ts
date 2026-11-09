import {useCallback} from 'react';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

export type PreprodEnabledWriteKey =
  | 'preprodSizeEnabledByCustomer'
  | 'preprodDistributionEnabledByCustomer';

interface UseFeatureFilterOptions {
  enabledReadKey: string;
  enabledWriteKey: PreprodEnabledWriteKey;
  project: DetailedProject;
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
  const enabled =
    (project[enabledWriteKey] ?? project.options?.[enabledReadKey]) !== false;

  const setFilterQuery = useCallback(
    (query: string) => {
      toast.loading(t('Saving...'));
      updateProject.mutate(
        {
          [queryWriteKey]: query === '' ? null : query,
        },
        {
          onSuccess: () => {
            toast.success(successMessage);
          },
          onError: () => {
            toast.error(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject, queryWriteKey, successMessage]
  );

  const setEnabled = useCallback(
    (newEnabled: boolean) => {
      toast.loading(t('Saving...'));
      updateProject.mutate(
        {
          [enabledWriteKey]: newEnabled,
        },
        {
          onSuccess: () => {
            toast.success(successMessage);
          },
          onError: () => {
            toast.error(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject, enabledWriteKey, successMessage]
  );

  return {filterQuery, setFilterQuery, enabled, setEnabled};
}
