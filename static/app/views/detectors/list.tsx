import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Monitors');
const DESCRIPTION = t(
  'Monitors are used to transform errors, performance problems, and other events into issues.'
);
const DOCS_URL = 'https://docs.sentry.io/product/monitors/';

export default function DetectorsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  const detectorListQuery = useDetectorListQuery();

  return (
    <SentryDocumentTitle title={TITLE}>
      <PageFiltersContainer>
        <WorkflowEngineListLayout
          actions={<DetectorListActions />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <DetectorListHeader />
          <DetectorListContent {...detectorListQuery} />
        </WorkflowEngineListLayout>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
