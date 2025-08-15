import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useIsMutating, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type StarTransactionParams = {
  project_id?: string;
  segment_name?: string;
};

const URL_PREFIX = '/insights/starred-segments/';

interface Props {
  segmentName: string;
  onError?: () => void;
  projectId?: string | undefined;
}

export function useStarredSegment({
  projectId,
  segmentName,
  onError: errorCallback,
}: Props) {
  const starredSegmentMutationKey = ['star-segment', segmentName];

  const organization = useOrganization();
  const api = useApi();
  const isMutating = useIsMutating({mutationKey: starredSegmentMutationKey});

  const url = `/organizations/${organization.slug}${URL_PREFIX}`;
  const data: StarTransactionParams = {
    project_id: projectId,
    segment_name: segmentName,
  };

  const onError = (message: string) => {
    addErrorMessage(message);
    errorCallback?.();
  };

  const onSuccess = (message: string) => {
    addSuccessMessage(message);
  };

  const {mutate: starTransaction} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: () => api.requestPromise(url, {method: 'POST', data}),
    onSuccess: () => onSuccess(t('Transaction starred')),
    onError: () => onError(t('Failed to star transaction')),
  });

  const {mutate: unstarTransaction} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: () => api.requestPromise(url, {method: 'DELETE', data}),
    onSuccess: () => onSuccess(t('Transaction unstarred')),
    onError: () => onError(t('Failed to unstar transaction')),
  });

  const setStarredSegment = (star: boolean) => {
    if (isMutating) {
      return;
    }

    addLoadingMessage();

    if (star) {
      starTransaction();
    } else {
      unstarTransaction();
    }
  };

  return {
    setStarredSegment,
    isPending: isMutating > 0,
  };
}
