import Breadcrumbs from 'sentry/components/breadcrumbs';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

export function NewDetectorBreadcrumbs({detectorType}: {detectorType: DetectorType}) {
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug, monitorsLinkPrefix),
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
  const {monitorsLinkPrefix} = useMonitorViewContext();
  return (
    <Breadcrumbs
      crumbs={[
        {
          label: t('Monitors'),
          to: makeMonitorBasePathname(organization.slug, monitorsLinkPrefix),
        },
        {
          label: detector.name,
          to: makeMonitorDetailsPathname(
            organization.slug,
            detector.id,
            monitorsLinkPrefix
          ),
        },
        {label: t('Configure')},
      ]}
    />
  );
}
