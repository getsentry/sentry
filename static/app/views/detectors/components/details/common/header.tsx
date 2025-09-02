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
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

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
            {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
            {label: detector.name},
          ]}
        />
        <DetailLayout.Title title={detector.name} project={project} />
      </DetailLayout.HeaderContent>
      <DetailLayout.Actions>
        <DisableDetectorAction detector={detector} />
        <EditDetectorAction detector={detector} />
      </DetailLayout.Actions>
    </DetailLayout.Header>
  );
}
