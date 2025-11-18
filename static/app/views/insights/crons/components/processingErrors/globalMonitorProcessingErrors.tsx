import {deleteProjectProcessingErrorByType} from 'sentry/actionCreators/monitors';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {MonitorProcessingErrors} from 'sentry/views/insights/crons/components/processingErrors/monitorProcessingErrors';
import {makeMonitorListErrorsQueryKey} from 'sentry/views/insights/crons/components/processingErrors/utils';
import type {
  CheckinProcessingError,
  ProcessingErrorType,
} from 'sentry/views/insights/crons/types';

interface GlobalMonitorProcessingErrorsProps {
  project?: string[];
}

export function GlobalMonitorProcessingErrors({
  project,
}: GlobalMonitorProcessingErrorsProps) {
  const api = useApi();
  const organization = useOrganization();

  const processingErrorQueryKey = makeMonitorListErrorsQueryKey(organization, project);
  const {data: processingErrors, refetch: refetchErrors} = useApiQuery<
    CheckinProcessingError[]
  >(processingErrorQueryKey, {
    staleTime: 0,
  });

  async function handleDismissError(errorType: ProcessingErrorType, projectId: string) {
    await deleteProjectProcessingErrorByType(
      api,
      organization.slug,
      projectId,
      errorType
    );
    await refetchErrors();
  }

  if (!processingErrors?.length) {
    return null;
  }

  return (
    <MonitorProcessingErrors
      checkinErrors={processingErrors}
      onDismiss={handleDismissError}
    >
      {t('Errors were encountered while ingesting check-ins for the selected projects')}
    </MonitorProcessingErrors>
  );
}
