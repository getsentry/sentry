import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {CustomRepo, CustomRepoFormData} from 'sentry/types/debugFiles';
import type {Project} from 'sentry/types/project';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';

import {expandKeys, getRequestMessages} from './utils';

export type RepositoryConfig = CustomRepo | CustomRepoFormData;

type UpdateCustomRepositoriesVariables = {
  repositories: RepositoryConfig[];
};

export function useUpdateCustomRepositoriesMutation(
  project: Project,
  currentRepositoryCount: number
) {
  const {mutateAsync: updateProject, ...mutationState} = useUpdateProject(project);

  const mutateAsync = useCallback(
    ({repositories}: UpdateCustomRepositoriesVariables) => {
      const {errorMessage, successMessage} = getRequestMessages(
        repositories.length,
        currentRepositoryCount
      );

      return updateProject({symbolSources: JSON.stringify(repositories.map(expandKeys))})
        .then(updatedProject => {
          addSuccessMessage(successMessage);
          return updatedProject;
        })
        .catch(error => {
          addErrorMessage(errorMessage);
          throw error;
        });
    },
    [currentRepositoryCount, updateProject]
  );

  return {...mutationState, mutateAsync};
}
