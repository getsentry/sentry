import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import WorkflowEngineListLayout from 'sentry/components/workflowEngine/layout/list';
import {t} from 'sentry/locale';
import {DetectorListActions} from 'sentry/views/detectors/list/common/actions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/header';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('My Monitors');
const DESCRIPTION = t('View monitors assigned to you or your teams.');
const DOCS_URL = 'https://docs.sentry.io/product/monitors/';

export default function MyMonitorsList() {
  const detectorListQuery = useDetectorListQuery({
    assigneeFilter: '[me,my_teams]',
  });

  return (
    <SentryDocumentTitle title={TITLE}>
      <PageFiltersContainer>
        <WorkflowEngineListLayout
          actions={<DetectorListActions />}
          title={TITLE}
          description={DESCRIPTION}
          docsUrl={DOCS_URL}
        >
          <DetectorListHeader showAssigneeFilter={false} />
          <DetectorListContent {...detectorListQuery} />
        </WorkflowEngineListLayout>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}
