import ErrorBoundary from 'sentry/components/errorBoundary';
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
import {TransactionsDatasetWarning} from 'sentry/views/detectors/components/details/metric/transactionsDatasetWarning';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

type MetricDetectorDetailsProps = {
  detector: MetricDetector;
  project: Project;
};

export function MetricDetectorDetails({detector, project}: MetricDetectorDetailsProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  const snubaDataset = snubaQuery?.dataset ?? Dataset.ERRORS;
  const eventTypes = snubaQuery?.eventTypes ?? [];
  const interval = snubaQuery?.timeWindow;
  const detectorDataset = getDetectorDataset(snubaDataset, eventTypes);

  const intervalSeconds = dataSource.queryObj?.snubaQuery.timeWindow;

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          {detectorDataset === DetectorDataset.TRANSACTIONS && (
            <TransactionsDatasetWarning />
          )}
          <MetricTimePeriodSelect dataset={detectorDataset} interval={interval} />
          {snubaQuery && (
            <MetricDetectorDetailsChart detector={detector} snubaQuery={snubaQuery} />
          )}
          <ErrorBoundary mini>
            <DetectorDetailsOngoingIssues
              detector={detector}
              intervalSeconds={intervalSeconds}
            />
          </ErrorBoundary>
          <DetectorDetailsAutomations detector={detector} />
        </DetailLayout.Main>
        <DetailLayout.Sidebar>
          <MetricDetectorDetailsSidebar detector={detector} />
        </DetailLayout.Sidebar>
      </DetailLayout.Body>
    </DetailLayout>
  );
}
