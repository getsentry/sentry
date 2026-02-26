import Feature from 'sentry/components/acl/feature';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Mobile Build Monitors');
const DESCRIPTION = t(
  'Mobile build monitors track app build sizes and detect regressions in your mobile applications.'
);
const DOCS_URL = 'https://docs.sentry.io/product/app-starts/app-size/';

export default function MobileBuildDetectorsList() {
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'preprod_size_analysis',
  });

  return (
    <Feature features="organizations:preprod-size-monitors-frontend">
      <SentryDocumentTitle title={TITLE}>
        <WorkflowEngineListLayout
          actions={<DetectorListActions detectorType="preprod_size_analysis" />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <DetectorListHeader showTypeFilter={false} />
          <DetectorListContent {...detectorListQuery} />
        </WorkflowEngineListLayout>
      </SentryDocumentTitle>
    </Feature>
  );
}
