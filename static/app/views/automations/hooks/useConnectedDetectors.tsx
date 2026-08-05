import {useQueries} from '@tanstack/react-query';
import chunk from 'lodash/chunk';

import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

const MAX_DETECTORS_PER_REQUEST = 100;

export function useConnectedDetectors() {
  const detectorIds = useFormField<string[]>('detectorIds') ?? [];
  const organization = useOrganization();
  const detectorIdChunks = chunk(detectorIds, MAX_DETECTORS_PER_REQUEST);

  const detectorQueries = useQueries({
    queries: detectorIdChunks.map(ids =>
      detectorListApiOptions(organization, {
        ids,
        includeIssueStreamDetectors: true,
      })
    ),
  });

  const connectedDetectors = detectorQueries.flatMap(query => query.data ?? []);
  const isLoading = detectorQueries.some(query => query.isLoading);

  return {connectedDetectors, isLoading};
}
