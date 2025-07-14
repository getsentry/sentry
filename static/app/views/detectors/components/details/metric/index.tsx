import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';
import {MetricDetectorDetailsSidebar} from 'sentry/views/detectors/components/details/metric/sidebar';

type MetricDetectorDetailsProps = {
  detector: MetricDetector;
  project: Project;
};

export function MetricDetectorDetails({detector, project}: MetricDetectorDetailsProps) {
  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DetectorDetailsOngoingIssues />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <MetricDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
