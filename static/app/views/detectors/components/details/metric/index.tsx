import {Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {DetailLayout} from 'sentry/components/workflowEngine/layout/detail';
import {t} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  DisableDetectorAction,
  EditDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
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
import {useDetectorStatsPeriods} from 'sentry/views/detectors/hooks/useDetectorStatsPeriods';

type MetricDetectorDetailsProps = {
  detector: MetricDetector;
};

export function MetricDetectorDetails({detector}: MetricDetectorDetailsProps) {
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
  useDetectorStatsPeriods(interval);

  return (
    <DetailLayout>
      <DetectorDetailsHeader detector={detector} />
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
          <Flex align="center" gap="sm" justify="between" wrap="wrap">
            <MetricTimePeriodSelect dataset={detectorDataset} interval={interval} />
            <Flex align="center" gap="sm" marginLeft="auto">
              <DisableDetectorAction detector={detector} />
              <EditDetectorAction detector={detector} />
            </Flex>
          </Flex>
          {snubaQuery && <MetricDetectorDetailsChart detector={detector} />}
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
