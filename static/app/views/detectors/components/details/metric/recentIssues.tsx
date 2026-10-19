import {useState} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';

import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {t} from 'sentry/locale';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useZoomToOpenPeriodRange} from 'sentry/views/detectors/components/details/common/useZoomToOpenPeriodRange';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const RECENT_ISSUES_LIMIT = 5;

const RECENT_ISSUE_COLUMNS: TableColumnConfig[] = [
  {key: 'issue', width: '1fr'},
  {key: 'status', width: 'min-content'},
  {key: 'started', width: '1fr'},
  {key: 'duration', width: 'min-content'},
  {key: 'zoom', width: 'min-content'},
];

interface DateParams {
  end: string | undefined;
  start: string | undefined;
  statsPeriod: string | undefined;
}

interface MetricDetectorRecentIssuesProps {
  detector: MetricDetector;
  /**
   * Pads the zoom range so short open periods stay visible on the chart.
   */
  intervalSeconds?: number;
}

/**
 * Lists the detector's most recent firings for orgs where each firing opens its own issue.
 */
export function MetricDetectorRecentIssues({
  detector,
  intervalSeconds,
}: MetricDetectorRecentIssuesProps) {
  const location = useLocation();

  const dateParams: DateParams = {
    start: decodeScalar(location.query.start),
    end: decodeScalar(location.query.end),
    statsPeriod: decodeScalar(location.query.statsPeriod),
  };

  return (
    <DetailSection
      title={t('Recent Issues')}
      trailingItems={
        <ViewAllIssuesButton
          detectorId={detector.id}
          projectId={detector.projectId}
          dateParams={dateParams}
        />
      }
    >
      <ErrorBoundary mini>
        <RecentIssuesTable
          detectorId={detector.id}
          dateParams={dateParams}
          intervalSeconds={intervalSeconds}
        />
      </ErrorBoundary>
    </DetailSection>
  );
}

interface ViewAllIssuesButtonProps {
  dateParams: DateParams;
  detectorId: string;
  projectId: string;
}

function ViewAllIssuesButton({
  detectorId,
  projectId,
  dateParams,
}: ViewAllIssuesButtonProps) {
  const organization = useOrganization();

  return (
    <LinkButton
      size="xs"
      to={{
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          query: `detector:${detectorId}`,
          project: projectId,
          sort: IssueSortOptions.NEW,
          ...dateParams,
        },
      }}
    >
      {t('View All')}
    </LinkButton>
  );
}

interface RecentIssuesTableProps {
  dateParams: DateParams;
  detectorId: string;
  intervalSeconds?: number;
}

function RecentIssuesTable({
  detectorId,
  dateParams,
  intervalSeconds,
}: RecentIssuesTableProps) {
  const zoomToOpenPeriodRange = useZoomToOpenPeriodRange(intervalSeconds);

  const openPeriodsQuery = useOpenPeriods({
    detectorId,
    limit: RECENT_ISSUES_LIMIT,
    ...dateParams,
  });

  if (openPeriodsQuery.isPending) {
    return <RecentIssuesTableSkeleton />;
  }

  if (openPeriodsQuery.isError) {
    return <RecentIssuesTableMessage message={t('Failed to load recent issues')} />;
  }

  if (!openPeriodsQuery.data.length) {
    return (
      <RecentIssuesTableMessage
        message={t('No issues for this monitor within the current date range')}
      />
    );
  }

  return (
    <SimpleTable columns={RECENT_ISSUE_COLUMNS} header={<RecentIssuesTableHeader />}>
      {openPeriodsQuery.data.map(openPeriod => (
        <RecentIssueRow
          key={openPeriod.id}
          openPeriod={openPeriod}
          onZoom={zoomToOpenPeriodRange}
        />
      ))}
    </SimpleTable>
  );
}

function RecentIssuesTableHeader() {
  return (
    <SimpleTable.HeaderRow>
      <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Started')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Duration')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell />
    </SimpleTable.HeaderRow>
  );
}

interface RecentIssueRowProps {
  onZoom: (start: Date, end?: Date) => void;
  openPeriod: GroupOpenPeriod;
}

function RecentIssueRow({openPeriod, onZoom}: RecentIssueRowProps) {
  const [now] = useState(() => new Date());
  const organization = useOrganization();

  const openPeriodStart = new Date(openPeriod.start);

  const openPeriodEnd = openPeriod.end ? new Date(openPeriod.end) : undefined;

  const openPeriodDurationSeconds =
    ((openPeriodEnd ?? now).getTime() - openPeriodStart.getTime()) / 1000;

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Link to={`/organizations/${organization.slug}/issues/${openPeriod.groupId}/`}>
          {openPeriod.shortId ?? t('View Issue')}
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {openPeriod.isOpen ? (
          <Tag variant="warning">{t('Ongoing')}</Tag>
        ) : (
          <Tag variant="success">{t('Resolved')}</Tag>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <DateTime date={openPeriodStart} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Duration seconds={openPeriodDurationSeconds} abbreviation />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Button size="xs" onClick={() => onZoom(openPeriodStart, openPeriodEnd)}>
          {t('Zoom')}
        </Button>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function RecentIssuesTableSkeleton() {
  return (
    <SimpleTable columns={RECENT_ISSUE_COLUMNS} header={<RecentIssuesTableHeader />}>
      {[0, 1, 2].map(index => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="80px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="64px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="60%" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="40px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            <Placeholder height="24px" width="48px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </SimpleTable>
  );
}

function RecentIssuesTableMessage({message}: {message: string}) {
  return (
    <SimpleTable>
      <SimpleTable.Empty>
        <EmptyState title={message} />
      </SimpleTable.Empty>
    </SimpleTable>
  );
}
