import {Client} from 'sentry/api';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

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
  });
}
