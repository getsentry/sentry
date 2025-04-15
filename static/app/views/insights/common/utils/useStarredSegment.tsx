import {useState} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
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
  project?: Project | undefined;
}

export function useStarredSegment({initialIsStarred, project, segmentName}: Props) {
  const [isStarred, setIsStarred] = useState(initialIsStarred);
  const organization = useOrganization();
  const api = useApi();

  const url = `/organizations/${organization.slug}${URL_PREFIX}`;
  const data: StarTransactionParams = {
    project_id: project?.id,
    segment_name: segmentName,
  };

  const onError = () => {
    addErrorMessage(t('Failed to star transaction'));
    setIsStarred(!isStarred);
  };

  const onSuccess = () => {
    addSuccessMessage(t('Transaction starred'));
  };

  const {mutate: starTransaction, ...starTransactionResult} = useMutation({
    mutationFn: () => api.requestPromise(url, {method: 'POST', data}),
    onSuccess,
    onError,
  });

  const {mutate: unstarTransaction, ...unstarTransactionResult} = useMutation({
    mutationFn: () => api.requestPromise(url, {method: 'DELETE', data}),
    onSuccess,
    onError,
  });

  const isPending =
    starTransactionResult.isPending || unstarTransactionResult.isPending || !project?.id;

  const toggleStarredTransaction = () => {
    if (isPending || !project?.id) {
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
