import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function NewDetectorBreadcrumbs({detectorType}: {detectorType: DetectorType}) {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {
          label: getDetectorTypeLabel(detectorType),
          to: makeMonitorTypePathname(organization.slug, detectorType),
        },
        {
          label: t('New %s Monitor', getDetectorTypeLabel(detectorType)),
        },
      ]}
    />
  );
}

export function EditDetectorBreadcrumbs({detector}: {detector: Detector}) {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug),
        },
        {
          label: getDetectorTypeLabel(detector.type),
          to: makeMonitorTypePathname(organization.slug, detector.type),
        },
        {
          label: detector.name,
          to: makeMonitorDetailsPathname(organization.slug, detector.id),
        },
        {label: t('Configure')},
      ]}
    />
  );
}
