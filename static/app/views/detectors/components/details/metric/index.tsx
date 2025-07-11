import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/primitives/actions';
import {DetectorDetailsSidebar} from 'sentry/views/detectors/components/detectorDetailsSidebar';
import IssuesList from 'sentry/views/detectors/components/issuesList';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

type MetricDetectorDetailsProps = {
  detector: Detector;
  project: Project;
};

export function MetricDetectorDetails({detector, project}: MetricDetectorDetailsProps) {
  const organization = useOrganization();

  return (
    <DetailLayout>
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
      <DetailLayout.Body>
        <DetailLayout.Main>
          {/* TODO: Add chart here */}
          <Section title={t('Ongoing Issues')}>
            {/* TODO: Replace with GroupList */}
            <IssuesList />
          </Section>
          <Section title={t('Connected Automations')}>
            <ErrorBoundary mini>
              <ConnectedAutomationsList automationIds={detector.workflowIds} />
            </ErrorBoundary>
          </Section>
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <DetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
