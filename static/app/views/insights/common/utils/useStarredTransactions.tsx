import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export type StarTransactionParams = {
  projectId: string;
  segmentName: string;
};

const URL_PREFIX = '/insights/starred-segments/';

export function useStarredTransactions() {
  const organization = useOrganization();
  const api = useApi();
  const url = `/organizations/${organization.slug}${URL_PREFIX}`;

  const {mutate: mutateStarTransaction, ...starTransactionResult} = useMutation({
    mutationFn: (params: StarTransactionParams) =>
      api.requestPromise(url, {
        method: 'POST',
        data: {
          project_id: params.projectId,
          segment_name: params.segmentName,
        },
      }),
    onSuccess: () => addSuccessMessage(t('Transaction starred')),
    onError: () => addErrorMessage(t('Failed to star transaction')),
  });

  const {mutate: mutateUnstarTransaction, ...unstarTransactionResult} = useMutation({
    mutationFn: (params: StarTransactionParams) =>
      api.requestPromise(url, {
        method: 'DELETE',
        data: {
          project_id: params.projectId,
          segment_name: params.segmentName,
        },
      }),
    onSuccess: () => addSuccessMessage(t('Transaction unstarred')),
    onError: () => addErrorMessage(t('Failed to unstar transaction')),
  });

  const starTransaction = (params: StarTransactionParams) => {
    addLoadingMessage();
    mutateStarTransaction(params);
  };

  const unstarTransaction = (params: StarTransactionParams) => {
    addLoadingMessage();
    mutateUnstarTransaction(params);
  };

  return {
    starTransaction,
    unstarTransaction,
    starTransactionResult,
    unstarTransactionResult,
  };
}
