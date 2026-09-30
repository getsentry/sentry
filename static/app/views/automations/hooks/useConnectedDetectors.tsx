import {useQuery} from '@tanstack/react-query';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

export function useConnectedDetectors(detectorIdsOverride?: string[]) {
  const formDetectorIds = useFormField<string[]>('detectorIds') ?? [];
  const detectorIds = detectorIdsOverride ?? formDetectorIds;
  const organization = useOrganization();

  const {
    data: connectedDetectors = [],
    isError,
    isLoading,
    refetch,
  } = useQuery({
    ...detectorListApiOptions(organization, {
      ids: detectorIds,
      includeIssueStreamDetectors: true,
    }),
    enabled: detectorIds.length > 0,
  });

  return {connectedDetectors, isError, isLoading, refetch};
}
