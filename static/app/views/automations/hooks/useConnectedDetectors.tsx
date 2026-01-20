import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

export function useConnectedDetectors() {
  const detectorIds = useFormField<string[]>('detectorIds') ?? [];
  const {data: detectors = []} = useDetectorsQuery(
    {ids: detectorIds, includeIssueStreamDetectors: true},
    {enabled: detectorIds.length > 0}
  );
  return detectors;
}
