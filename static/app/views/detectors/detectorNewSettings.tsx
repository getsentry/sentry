import {skipToken, useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useDetectorTypeQueryState} from 'sentry/views/detectors/components/detectorTypeForm';
import {NewDetectorForm} from 'sentry/views/detectors/components/forms';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {
  detectorTypeIsAvailableForCreation,
  getDetectorTypeLabel,
  isValidDetectorType,
} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export default function DetectorNewSettings() {
  const organization = useOrganization();
  const {fetching: isFetchingProjects} = useProjects();
  const [detectorType] = useDetectorTypeQueryState();
  const [duplicateFrom] = useQueryState('duplicateFrom', parseAsString);
  const canCreateDetector = useCanCreateDetector(detectorType);
  const canDuplicateMonitors = organization.features.includes('monitor-duplication');
  const isDetectorTypeAvailable =
    detectorType &&
    isValidDetectorType(detectorType) &&
    detectorTypeIsAvailableForCreation(detectorType, organization);
  const duplicatePath =
    canDuplicateMonitors && duplicateFrom && isDetectorTypeAvailable
      ? {
          organizationIdOrSlug: organization.slug,
          detectorId: duplicateFrom,
        }
      : skipToken;

  const duplicateQuery = useQuery({
    ...apiOptions.as<Detector>()(
      '/organizations/$organizationIdOrSlug/detectors/$detectorId/',
      {
        path: duplicatePath,
        staleTime: 0,
      }
    ),
    retry: false,
  });
  const duplicateDetector = duplicateQuery.data;
  const canDuplicateDetector = useCanEditDetector({
    detectorType: duplicateDetector?.type ?? detectorType,
    projectId: duplicateDetector?.projectId ?? null,
  });

  if (duplicateFrom && (!canDuplicateMonitors || !isDetectorTypeAvailable)) {
    return <LoadingError message={t('This monitor cannot be duplicated.')} />;
  }

  if (!detectorType || !isValidDetectorType(detectorType)) {
    return <LoadingError message={t('Invalid detector type: %s', detectorType ?? '')} />;
  }

  if (isFetchingProjects || (duplicateFrom && duplicateQuery.isPending)) {
    return <LoadingIndicator />;
  }

  if (duplicateFrom && duplicateQuery.isError) {
    return (
      <LoadingError
        message={t('The monitor to duplicate could not be loaded.')}
        onRetry={duplicateQuery.refetch}
      />
    );
  }

  if (!canCreateDetector) {
    return <LoadingError message={getNoPermissionToCreateMonitorsTooltip()} />;
  }

  if (
    duplicateDetector &&
    (duplicateDetector.type !== detectorType ||
      !detectorTypeIsAvailableForCreation(duplicateDetector.type, organization))
  ) {
    return <LoadingError message={t('This monitor cannot be duplicated.')} />;
  }

  if (duplicateDetector && !canDuplicateDetector) {
    return <LoadingError message={getNoPermissionToCreateMonitorsTooltip()} />;
  }

  return (
    <DetectorFormProvider
      detectorType={detectorType}
      duplicateDetector={duplicateDetector}
    >
      <SentryDocumentTitle
        title={
          duplicateDetector
            ? t('Duplicate %s Monitor', getDetectorTypeLabel(detectorType))
            : t('New %s Monitor', getDetectorTypeLabel(detectorType))
        }
      />
      <NewDetectorForm detectorType={detectorType} />
    </DetectorFormProvider>
  );
}
