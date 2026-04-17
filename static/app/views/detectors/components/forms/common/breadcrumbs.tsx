import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
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

export function ErrorDetectorProjectBreadcrumbs({
  detector,
  project,
  includeConfigure = false,
}: {
  detector: Detector;
  includeConfigure?: boolean;
  project?: Project;
}) {
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
        ...(project
          ? [{label: <ProjectBadge disableLink project={project} avatarSize={16} />}]
          : []),
        ...(includeConfigure ? [{label: t('Configure')}] : []),
      ]}
    />
  );
}
