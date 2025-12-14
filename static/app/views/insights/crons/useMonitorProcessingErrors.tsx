import {useCallback} from 'react';

import {deleteMonitorProcessingErrorByType} from 'sentry/actionCreators/monitors';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {makeMonitorErrorsQueryKey} from 'sentry/views/insights/crons/components/processingErrors/utils';
import type {
  CheckinProcessingError,
  ProcessingErrorType,
} from 'sentry/views/insights/crons/types';

interface UseMonitorProcessingErrorsOptions {
  monitorSlug: string;
  organization: Organization;
  projectId: string;
}

export function useMonitorProcessingErrors({
  organization,
  projectId,
  monitorSlug,
}: UseMonitorProcessingErrorsOptions) {
  const api = useApi();

  const {data: checkinErrors, refetch: refetchErrors} = useApiQuery<
    CheckinProcessingError[]
  >(makeMonitorErrorsQueryKey(organization, projectId, monitorSlug), {
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleDismissError = useCallback(
    async (errortype: ProcessingErrorType) => {
      await deleteMonitorProcessingErrorByType(
        api,
        organization.slug,
        projectId,
        monitorSlug,
        errortype
      );
      await refetchErrors();
    },
    [api, organization.slug, projectId, monitorSlug, refetchErrors]
  );

  return {
    checkinErrors,
    handleDismissError,
  };
}
