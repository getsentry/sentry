import {useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type StarTransactionParams = {
  project_id?: string;
  segment_name?: string;
};

const URL_PREFIX = '/insights/starred-segments/';

interface Props {
  initialIsStarred: boolean;
  segmentName: string;
  projectId?: string | undefined;
}

export function useStarredSegment({initialIsStarred, projectId, segmentName}: Props) {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const organization = useOrganization();
  const api = useApi();

  const url = `/organizations/${organization.slug}${URL_PREFIX}`;
  const data: StarTransactionParams = {
    project_id: projectId,
    segment_name: segmentName,
  };

  const onError = (message: string) => {
    addErrorMessage(message);
    setIsStarred(!isStarred);
  };

  const onSuccess = (message: string) => {
    addSuccessMessage(message);
  };

  const {mutate: starTransaction, ...starTransactionResult} = useMutation({
    mutationFn: () => api.requestPromise(url, {method: 'POST', data}),
    onSuccess: () => onSuccess(t('Transaction starred')),
    onError: () => onError(t('Failed to star transaction')),
  });

  const {mutate: unstarTransaction, ...unstarTransactionResult} = useMutation({
    mutationFn: () => api.requestPromise(url, {method: 'DELETE', data}),
    onSuccess: () => onSuccess(t('Transaction unstarred')),
    onError: () => onError(t('Failed to unstar transaction')),
  });

  const isPending =
    starTransactionResult.isPending || unstarTransactionResult.isPending || !projectId;

  const toggleStarredTransaction = () => {
    if (isPending) {
      return;
    }

    addLoadingMessage();

    if (isStarred) {
      unstarTransaction();
    } else {
      starTransaction();
    }
    setIsStarred(!isStarred);
  };

  return {
    toggleStarredTransaction,
    isPending,
    isStarred,
  };
}
