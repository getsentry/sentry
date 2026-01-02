import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Error Monitors');
const DESCRIPTION = t(
  'Error monitors are created by default for each project based on issue grouping/fingerprint rules.'
);
const DOCS_URL =
  'https://docs.sentry.io/product/new-monitors-and-alerts/monitors/#default-monitors';

export default function ErrorDetectorsList() {
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'error',
  });

  return (
    <SentryDocumentTitle title={TITLE}>
      <WorkflowEngineListLayout
        actions={<DetectorListActions detectorType="error" />}
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
