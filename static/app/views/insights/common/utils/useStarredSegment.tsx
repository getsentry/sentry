import {useIsMutating, useMutation} from '@tanstack/react-query';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
type StarServiceSpanParams = {
  project_id?: string;
  service_span?: string;
};

const URL_PREFIX = '/starred-service-spans/';

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
  const data: StarServiceSpanParams = {
    project_id: projectId,
    service_span: segmentName,
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
    mutationFn: () => api.requestPromise(url, {method: 'DELETE', query: data}),
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
