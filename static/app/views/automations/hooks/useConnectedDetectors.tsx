import {useQuery} from '@tanstack/react-query';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

export function useConnectedDetectors() {
  const detectorIds = useFormField<string[]>('detectorIds') ?? [];
  const organization = useOrganization();

  const {data: connectedDetectors = [], isLoading} = useQuery({
    ...detectorListApiOptions(organization, {
      ids: detectorIds,
      includeIssueStreamDetectors: true,
    }),
    enabled: detectorIds.length > 0,
  });

  return {connectedDetectors, isLoading};
}
