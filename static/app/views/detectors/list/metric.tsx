import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Metric Monitors');
const DESCRIPTION = t(
  'Metric monitors track errors based on span attributes and custom metrics.'
);
const DOCS_URL =
  'https://docs.sentry.io/product/new-monitors-and-alerts/monitors/#metric-monitor-settings';

export default function MetricDetectorsList() {
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'metric_issue',
  });

  return (
    <SentryDocumentTitle title={TITLE}>
      <WorkflowEngineListLayout
        actions={<DetectorListActions detectorType="metric_issue" />}
        title={TITLE}
        description={DESCRIPTION}
        docsUrl={DOCS_URL}
      >
        <DetectorListHeader showTypeFilter={false} />
        <DetectorListContent {...detectorListQuery} />
      </WorkflowEngineListLayout>
    </SentryDocumentTitle>
  );
}
