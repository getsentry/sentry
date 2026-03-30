import {useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

const ENABLED_KEY = 'sentry:preprod_snapshot_status_checks_enabled';
const FAIL_ON_ADDED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_added';
const FAIL_ON_REMOVED_KEY = 'sentry:preprod_snapshot_status_checks_fail_on_removed';

export function useSnapshotStatusChecks(project: Project) {
  const updateProject = useUpdateProject(project);

  const enabled =
    project.preprodSnapshotStatusChecksEnabled ??
    project.options?.[ENABLED_KEY] !== false;

  const failOnAdded =
    project.preprodSnapshotStatusChecksFailOnAdded ??
    project.options?.[FAIL_ON_ADDED_KEY] === true;

  const failOnRemoved =
    project.preprodSnapshotStatusChecksFailOnRemoved ??
    project.options?.[FAIL_ON_REMOVED_KEY] === true;

  const setEnabled = useCallback(
    (value: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {preprodSnapshotStatusChecksEnabled: value},
        {
          onSuccess: () => {
            addSuccessMessage(
              value
                ? t('Snapshot status checks enabled.')
                : t('Snapshot status checks disabled.')
            );
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject]
  );

  const setFailOnAdded = useCallback(
    (value: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {preprodSnapshotStatusChecksFailOnAdded: value},
        {
          onSuccess: () => {
            addSuccessMessage(t('Snapshot status check settings updated.'));
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject]
  );

  const setFailOnRemoved = useCallback(
    (value: boolean) => {
      addLoadingMessage(t('Saving...'));
      updateProject.mutate(
        {preprodSnapshotStatusChecksFailOnRemoved: value},
        {
          onSuccess: () => {
            addSuccessMessage(t('Snapshot status check settings updated.'));
          },
          onError: () => {
            addErrorMessage(t('Failed to save changes. Please try again.'));
          },
        }
      );
    },
    [updateProject]
  );

  return {
    enabled,
    failOnAdded,
    failOnRemoved,
    setEnabled,
    setFailOnAdded,
    setFailOnRemoved,
  };
}
