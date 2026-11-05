import {useCallback} from 'react';
import {useQuery} from '@tanstack/react-query';

import {deleteMonitorProcessingErrorByType} from 'sentry/actionCreators/monitors';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';

import {monitorErrorsApiOptions} from './components/processingErrors/utils';
import type {ProcessingErrorType} from './types';

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

  const {data: checkinErrors, refetch: refetchErrors} = useQuery({
    ...monitorErrorsApiOptions(organization, projectId, monitorSlug),
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
