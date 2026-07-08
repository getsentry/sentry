import * as Sentry from '@sentry/react';

import {CustomRepoType} from 'sentry/types/debugFiles';

/**
 * Applies the final shaping expected by the API before the repository is
 * persisted. For object-storage repositories an empty secret means "keep the
 * previously stored secret", which is represented by the `hidden-secret` flag.
 */
export function getFinalData(type: CustomRepoType, data: Record<string, any>) {
  if (type === CustomRepoType.HTTP) {
    return data;
  }

  switch (type) {
    case CustomRepoType.S3:
      return {
        ...data,
        secret_key: data.secret_key ?? {
          'hidden-secret': true,
        },
      };
    case CustomRepoType.GCS:
      return {
        ...data,
        private_key: data.private_key ?? {
          'hidden-secret': true,
        },
      };
    default: {
      Sentry.captureException(new Error('Unknown custom repository type'));
      return {}; // this shall never happen
    }
  }
}
