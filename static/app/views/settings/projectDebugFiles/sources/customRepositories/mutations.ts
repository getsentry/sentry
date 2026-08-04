import {mutationOptions} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {CustomRepo, CustomRepoFormData} from 'sentry/types/debugFiles';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';

import {expandKeys, getRequestMessages} from './utils';

export type RepositoryConfig = CustomRepo | CustomRepoFormData;

type UpdateCustomRepositoriesVariables = {
  repositories: RepositoryConfig[];
  refresh?: boolean;
};

type Options = {
  currentRepositoryCount: number;
  organizationSlug: string;
  projectSlug: string;
};

export function updateCustomRepositoriesMutationOptions({
  currentRepositoryCount,
  organizationSlug,
  projectSlug,
}: Options) {
  return mutationOptions({
    mutationFn: ({repositories}: UpdateCustomRepositoriesVariables) =>
      fetchMutation<Project>({
        url: `/projects/${organizationSlug}/${projectSlug}/`,
        method: 'PUT',
        data: {symbolSources: JSON.stringify(repositories.map(expandKeys))},
      }),
    onError: (_error, {repositories}) => {
      const {errorMessage} = getRequestMessages(
        repositories.length,
        currentRepositoryCount
      );
      addErrorMessage(errorMessage);
    },
    onSuccess: (project, {refresh, repositories}) => {
      const {successMessage} = getRequestMessages(
        repositories.length,
        currentRepositoryCount
      );
      ProjectsStore.onUpdateSuccess(project);
      addSuccessMessage(successMessage);

      if (refresh) {
        window.location.reload();
      }
    },
  });
}
