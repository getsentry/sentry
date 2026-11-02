import {useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';

export function useUpdateWizardCache(hash: string) {
  return useMutation({
    mutationFn: (params: {organizationId: string; projectId: string}) =>
      fetchMutation({
        url: getApiUrl('/wizard/$wizardHash/session/', {path: {wizardHash: hash}}),
        method: 'PUT',
        data: params,
      }),
    onError: error => {
      const errorMessage =
        error instanceof RequestError &&
        error.responseJSON?.detail === 'No DSN found for this project'
          ? t(
              'The selected project has no active DSN. Please add an active DSN to the project.'
            )
          : t('Something went wrong! Please try again.');

      addErrorMessage(errorMessage);
    },
  });
}
