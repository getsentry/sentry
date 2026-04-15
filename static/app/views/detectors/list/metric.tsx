import {Link} from '@sentry/scraps/link';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {WorkflowEngineListLayout} from 'sentry/components/workflowEngine/layout/list';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DetectorListActions} from 'sentry/views/detectors/list/common/detectorListActions';
import {DetectorListContent} from 'sentry/views/detectors/list/common/detectorListContent';
import {DetectorListHeader} from 'sentry/views/detectors/list/common/detectorListHeader';
import {useDetectorListQuery} from 'sentry/views/detectors/list/common/useDetectorListQuery';

const TITLE = t('Metric Monitors');
const DOCS_URL =
  'https://docs.sentry.io/product/new-monitors-and-alerts/monitors/#metric-monitor-settings';

export default function MetricDetectorsList() {
  const organization = useOrganization();
  const detectorListQuery = useDetectorListQuery({
    detectorFilter: 'metric_issue',
  });

  const description = tct(
    'Metric Monitors automatically create [issuesLink:Issues] when queries meet defined thresholds.',
    {
      issuesLink: <Link to={`/organizations/${organization.slug}/issues/`} />,
    }
  );

  return (
    <SentryDocumentTitle title={TITLE}>
      <WorkflowEngineListLayout
        actions={<DetectorListActions detectorType="metric_issue" />}
        title={TITLE}
        description={description}
        docsUrl={DOCS_URL}
      >
        <DetectorListHeader showTypeFilter={false} />
        <DetectorListContent
          isError={detectorListQuery.isError}
          isLoading={detectorListQuery.isLoading}
          isSuccess={detectorListQuery.isSuccess}
          data={detectorListQuery.data}
        />
      </WorkflowEngineListLayout>
    </SentryDocumentTitle>
  );
}
