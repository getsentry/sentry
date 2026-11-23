import {useIsMutating, useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  segmentName: string;
  onError?: (previousIsStarred: boolean) => void;
  projectId?: string | undefined;
}

export function useStarredSegment({
  projectId,
  segmentName,
  onError: errorCallback,
}: Props) {
  const starredSegmentMutationKey = ['star-segment', segmentName];

  const organization = useOrganization();
  const isMutating = useIsMutating({mutationKey: starredSegmentMutationKey});

  const url = getApiUrl('/organizations/$organizationIdOrSlug/starred-service-spans/', {
    path: {organizationIdOrSlug: organization.slug},
  });
  const data = {project_id: projectId, service_span: segmentName};

  const {mutate} = useMutation({
    mutationKey: starredSegmentMutationKey,
    mutationFn: (star: boolean) =>
      star
        ? fetchMutation({url, method: 'POST', data})
        : fetchMutation({url, method: 'DELETE', options: {query: data}}),
    onSuccess: (_, star) => {
      toast.success(star ? t('Transaction starred') : t('Transaction unstarred'));
    },
    onError: (_, star) => {
      toast.error(
        star ? t('Failed to star transaction') : t('Failed to unstar transaction')
      );
      errorCallback?.(!star);
    },
  });

  const setStarredSegment = (star: boolean) => {
    if (isMutating) {
      return;
    }

    toast.loading(t('Saving changes...'));
    mutate(star);
  };

  return {setStarredSegment, isPending: isMutating > 0};
}
