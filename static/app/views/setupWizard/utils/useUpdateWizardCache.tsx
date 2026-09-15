import {useMutation} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
const BASE_API_CLIENT = new Client({baseUrl: ''});

export function useUpdateWizardCache(hash: string) {
  const baseApi = useApi({api: BASE_API_CLIENT});
  return useMutation({
    mutationFn: (params: {organizationId: string; projectId: string}) => {
      return baseApi.requestPromise(`/account/settings/wizard/${hash}/`, {
        method: 'POST',
        data: params,
      });
    },
    onError: error => {
      const errorMessage =
        error instanceof RequestError &&
        error.responseJSON?.error === 'No DSN found for this project'
          ? t(
              'The selected project has no active DSN. Please add an active DSN to the project.'
            )
          : t('Something went wrong! Please try again.');

      addErrorMessage(errorMessage);
    },
  });
}
