import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {
  makeMonitorBasePathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

type DetectorDetailsHeaderProps = {
  detector: Detector;
  project: Project;
};

export function DetectorDetailsHeader({detector, project}: DetectorDetailsHeaderProps) {
  const organization = useOrganization();

  return (
    <DetailLayout.Header>
      <DetailLayout.HeaderContent>
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
            {label: detector.name},
          ]}
        />
        <DetailLayout.Title title={detector.name} project={project} />
      </DetailLayout.HeaderContent>
      <DetailLayout.Actions>
        <MonitorFeedbackButton />
        <DisableDetectorAction detector={detector} />
        <EditDetectorAction detector={detector} />
      </DetailLayout.Actions>
    </DetailLayout.Header>
  );
}
