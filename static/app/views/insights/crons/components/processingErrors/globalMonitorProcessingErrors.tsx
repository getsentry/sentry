import {useQuery} from '@tanstack/react-query';

import {deleteProjectProcessingErrorByType} from 'sentry/actionCreators/monitors';
import {t} from 'sentry/locale';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ProcessingErrorType} from 'sentry/views/insights/crons/types';

import {MonitorProcessingErrors} from './monitorProcessingErrors';
import {monitorListErrorsApiOptions} from './utils';

interface GlobalMonitorProcessingErrorsProps {
  project?: string[];
}

export function GlobalMonitorProcessingErrors({
  project,
}: GlobalMonitorProcessingErrorsProps) {
  const api = useApi();
  const organization = useOrganization();

  const processingErrorOptions = monitorListErrorsApiOptions(organization, project);
  const {data: processingErrors, refetch: refetchErrors} =
    useQuery(processingErrorOptions);

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
