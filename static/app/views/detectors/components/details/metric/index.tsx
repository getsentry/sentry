import ErrorBoundary from 'sentry/components/errorBoundary';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {DetectorDetailsAutomations} from 'sentry/views/detectors/components/details/common/automations';
import {DisabledAlert} from 'sentry/views/detectors/components/details/common/disabledAlert';
import {DetectorDetailsHeader} from 'sentry/views/detectors/components/details/common/header';
import {DetectorDetailsOpenPeriodIssues} from 'sentry/views/detectors/components/details/common/openPeriodIssues';
import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';
import {MetricDetectorDetailsSidebar} from 'sentry/views/detectors/components/details/metric/sidebar';
import {MetricTimePeriodSelect} from 'sentry/views/detectors/components/details/metric/timePeriodSelect';
import {
  MigratedAlertWarning,
  TransactionsDatasetWarning,
} from 'sentry/views/detectors/components/details/metric/transactionsDatasetWarning';
import {useIsMigratedExtrapolation} from 'sentry/views/detectors/components/details/metric/utils/useIsMigratedExtrapolation';
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
  const extrapolationMode = snubaQuery?.extrapolationMode;
  const showExtrapolationModeWarning = useIsMigratedExtrapolation({
    dataset: detectorDataset,
    extrapolationMode,
  });

  const intervalSeconds = dataSource.queryObj?.snubaQuery.timeWindow;

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} project={project} />
      <DetailLayout.Body>
        <DetailLayout.Main>
          <DisabledAlert
            detector={detector}
            message={t('This monitor is disabled and not creating issues.')}
          />
          {detectorDataset === DetectorDataset.TRANSACTIONS && (
            <TransactionsDatasetWarning />
          )}
          {showExtrapolationModeWarning && <MigratedAlertWarning detector={detector} />}
          <MetricTimePeriodSelect dataset={detectorDataset} interval={interval} />
          {snubaQuery && (
            <MetricDetectorDetailsChart detector={detector} snubaQuery={snubaQuery} />
          )}
          <ErrorBoundary mini>
            <DetectorDetailsOpenPeriodIssues
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
