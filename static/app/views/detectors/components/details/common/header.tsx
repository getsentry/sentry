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
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

type DetectorDetailsHeaderProps = {
  detector: Detector;
  project: Project;
};

export function DetectorDetailsHeader({detector, project}: DetectorDetailsHeaderProps) {
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();

  return (
    <DetailLayout.Header>
      <DetailLayout.HeaderContent>
        <Breadcrumbs
          crumbs={[
            {
              label: t('Monitors'),
              to: makeMonitorBasePathname(organization.slug, monitorsLinkPrefix),
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
