import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {AlertsRedirectNotice} from 'sentry/views/detectors/list/common/alertsRedirectNotice';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Monitors');
const DESCRIPTION = t(
  'Monitors are used to transform errors, performance problems, and other events into issues.'
);
const DOCS_URL = 'https://docs.sentry.io/product/new-monitors-and-alerts/monitors/';

export default function AllMonitors() {
  const detectorListQuery = useDetectorListQuery();

  return (
    <SentryDocumentTitle title={TITLE}>
      <WorkflowEngineListLayout
        actions={<DetectorListActions detectorType={null} />}
        title={TITLE}
        description={DESCRIPTION}
        docsUrl={DOCS_URL}
      >
        <AlertsRedirectNotice>
          {t('Alert Rules have been moved to Monitors and Alerts.')}
        </AlertsRedirectNotice>
        <DetectorListHeader />
        <DetectorListContent {...detectorListQuery} />
      </WorkflowEngineListLayout>
    </SentryDocumentTitle>
  );
}
