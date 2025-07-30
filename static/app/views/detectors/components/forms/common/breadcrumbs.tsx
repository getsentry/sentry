import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {DETECTOR_TYPE_LABELS} from 'sentry/views/detectors/constants';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

export function NewDetectorBreadcrumbs({detectorType}: {detectorType: DetectorType}) {
  const organization = useOrganization();
  return (
    <Breadcrumbs
      crumbs={[
        {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
        {
          label: t('New %s Monitor', DETECTOR_TYPE_LABELS[detectorType]),
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
        {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
        {
          label: detector.name,
          to: makeMonitorDetailsPathname(organization.slug, detector.id),
        },
        {label: t('Configure')},
      ]}
    />
  );
}
