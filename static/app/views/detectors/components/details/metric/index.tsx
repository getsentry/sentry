import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOngoingIssues} from 'sentry/views/detectors/components/details/common/ongoingIssues';
import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';
import {MetricDetectorDetailsSidebar} from 'sentry/views/detectors/components/details/metric/sidebar';
import {MetricTimePeriodSelect} from 'sentry/views/detectors/components/details/metric/timePeriodSelect';

type MetricDetectorDetailsProps = {
  detector: MetricDetector;
  project: Project;
};

export function MetricDetectorDetails({detector, project}: MetricDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  const dataset = snubaQuery?.dataset ?? Dataset.ERRORS;
  const interval = snubaQuery?.timeWindow;

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <MetricTimePeriodSelect dataset={dataset} interval={interval} />
          <MetricDetectorDetailsChart detector={detector} />
          <DetectorDetailsOngoingIssues detectorId={detector.id} />
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <MetricDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
