import forEach from 'lodash/forEach';
import set from 'lodash/set';

import {t} from 'sentry/locale';
import type {CustomRepo} from 'sentry/types/debugFiles';
import {CustomRepoType} from 'sentry/types/debugFiles';

export const customRepoTypeLabel = {
  [CustomRepoType.HTTP]: 'SymbolServer (HTTP)',
  [CustomRepoType.S3]: 'Amazon S3',
  [CustomRepoType.GCS]: 'Google Cloud Storage',
};

export const dropDownItems = [
  {
    key: CustomRepoType.S3,
    label: customRepoTypeLabel[CustomRepoType.S3],
  },
  {
    key: CustomRepoType.GCS,
    label: customRepoTypeLabel[CustomRepoType.GCS],
  },
  {
    key: CustomRepoType.HTTP,
    label: customRepoTypeLabel[CustomRepoType.HTTP],
  },
];

export function getRequestMessages(
  updatedRepositoriesQuantity: number,
  repositoriesQuantity: number
) {
  if (updatedRepositoriesQuantity > repositoriesQuantity) {
    return {
      successMessage: t('Successfully added custom repository'),
      errorMessage: t('An error occurred while adding a new custom repository'),
    };
  }

  if (updatedRepositoriesQuantity < repositoriesQuantity) {
    return {
      successMessage: t('Successfully removed custom repository'),
      errorMessage: t('An error occurred while removing the custom repository'),
    };
  }

  return {
    successMessage: t('Successfully updated custom repository'),
    errorMessage: t('An error occurred while updating the custom repository'),
  };
}

export function expandKeys(obj: CustomRepo) {
  const result: Record<string, string> = {};
  forEach(obj, (value, key) => {
    set(result, key.split('.'), value);
  });
  return result;
}
