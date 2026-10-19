import {Fragment, useState} from 'react';
import {IconChevron} from '@sentry/icons/chevron';
import sumBy from 'lodash/sumBy';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

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
import {getOpenPeriodDurationSeconds} from 'sentry/views/detectors/utils/getOpenPeriodDurationSeconds';
import {
  groupOpenPeriodsByIssue,
  type IssueOpenPeriods,
} from 'sentry/views/detectors/utils/groupOpenPeriodsByIssue';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

const RECENT_ISSUES_LIMIT = 5;

const OPEN_PERIODS_LIMIT = 100;

const RECENT_ISSUE_COLUMNS: TableColumnConfig[] = [
  {key: 'expand', width: 'min-content'},
  {key: 'issue', width: '1fr'},
  {key: 'status', width: 'min-content'},
  {key: 'lastOpened', width: '1fr'},
  {key: 'duration', width: 'min-content'},
  {key: 'openPeriods', width: 'min-content'},
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
 * Show the detector's most recent issues for the time range the user specified
 * Each issue's open periods are grouped together and visible within a dropdown
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
      title={
        <Flex as="span" align="center" gap="sm">
          {t('Recent Issues')}
          <InfoTip
            size="sm"
            title={t(
              'Sentry will open a new issue if your monitor has not breached in the past 24 hours'
            )}
          />
        </Flex>
      }
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
          sort: IssueSortOptions.DATE,
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
    limit: OPEN_PERIODS_LIMIT,
    ...dateParams,
  });

  if (openPeriodsQuery.isPending) {
    return <RecentIssuesTableSkeleton />;
  }

  if (openPeriodsQuery.isError) {
    return <RecentIssuesTableMessage message={t('Failed to load recent issues')} />;
  }

  const recentIssues = groupOpenPeriodsByIssue(openPeriodsQuery.data).slice(
    0,
    RECENT_ISSUES_LIMIT
  );

  if (!recentIssues.length) {
    return (
      <RecentIssuesTableMessage
        message={t('No issues for this monitor within the current date range')}
      />
    );
  }

  return (
    <SimpleTable columns={RECENT_ISSUE_COLUMNS} header={<RecentIssuesTableHeader />}>
      {recentIssues.map(issue => (
        <RecentIssue key={issue.groupId} issue={issue} onZoom={zoomToOpenPeriodRange} />
      ))}
    </SimpleTable>
  );
}

function RecentIssuesTableHeader() {
  return (
    <SimpleTable.HeaderRow>
      <SimpleTable.HeaderCell />
      <SimpleTable.HeaderCell divider={false}>{t('Issue')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Last Opened')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Duration')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Open Periods')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell />
    </SimpleTable.HeaderRow>
  );
}

interface RecentIssueProps {
  issue: IssueOpenPeriods;
  onZoom: (start: Date, end?: Date) => void;
}

function RecentIssue({issue, onZoom}: RecentIssueProps) {
  const [now] = useState(() => new Date());

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Fragment>
      <RecentIssueRow
        issue={issue}
        now={now}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(!isExpanded)}
        onZoom={onZoom}
      />
      {isExpanded &&
        issue.openPeriods.map(openPeriod => (
          <IssueOpenPeriodRow
            key={openPeriod.id}
            openPeriod={openPeriod}
            now={now}
            onZoom={onZoom}
          />
        ))}
    </Fragment>
  );
}

interface RecentIssueRowProps {
  isExpanded: boolean;
  issue: IssueOpenPeriods;
  now: Date;
  onToggleExpanded: () => void;
  onZoom: (start: Date, end?: Date) => void;
}

function RecentIssueRow({
  issue,
  now,
  isExpanded,
  onToggleExpanded,
  onZoom,
}: RecentIssueRowProps) {
  const organization = useOrganization();

  const latestOpenPeriod = issue.openPeriods[0];

  const earliestOpenPeriod = issue.openPeriods.at(-1) ?? latestOpenPeriod;

  const earliestOpenPeriodStart = new Date(earliestOpenPeriod.start);

  const latestOpenPeriodEnd = latestOpenPeriod.end
    ? new Date(latestOpenPeriod.end)
    : undefined;

  const totalOpenDurationSeconds = sumBy(issue.openPeriods, openPeriod =>
    getOpenPeriodDurationSeconds(openPeriod, now)
  );

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell paddingRight="0">
        <Button
          size="xs"
          variant="transparent"
          icon={<IconChevron direction={isExpanded ? 'down' : 'right'} />}
          aria-label={isExpanded ? t('Hide open periods') : t('Show open periods')}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Link to={`/organizations/${organization.slug}/issues/${issue.groupId}/`}>
          {issue.shortId ?? t('View Issue')}
        </Link>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {latestOpenPeriod.isOpen ? (
          <Tag variant="warning">{t('Ongoing')}</Tag>
        ) : (
          <Tag variant="success">{t('Resolved')}</Tag>
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <DateTime date={latestOpenPeriod.start} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Duration seconds={totalOpenDurationSeconds} abbreviation />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text tabular>{issue.openPeriods.length}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Button
          size="xs"
          onClick={() => onZoom(earliestOpenPeriodStart, latestOpenPeriodEnd)}
        >
          {t('Zoom')}
        </Button>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

interface IssueOpenPeriodRowProps {
  now: Date;
  onZoom: (start: Date, end?: Date) => void;
  openPeriod: GroupOpenPeriod;
}

function IssueOpenPeriodRow({openPeriod, now, onZoom}: IssueOpenPeriodRowProps) {
  const openPeriodStart = new Date(openPeriod.start);

  const openPeriodEnd = openPeriod.end ? new Date(openPeriod.end) : undefined;

  const openPeriodDurationSeconds = getOpenPeriodDurationSeconds(openPeriod, now);

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell background="secondary" alignSelf="stretch" />
      <SimpleTable.RowCell background="secondary" alignSelf="stretch">
        <Text>
          {t('Opened')} <DateTime date={openPeriodStart} />
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell background="secondary" alignSelf="stretch" />
      <SimpleTable.RowCell background="secondary" alignSelf="stretch">
        <Text>
          {openPeriodEnd ? (
            <Fragment>
              {t('Closed')} <DateTime date={openPeriodEnd} />
            </Fragment>
          ) : (
            t('Ongoing')
          )}
        </Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell background="secondary" alignSelf="stretch">
        <Duration seconds={openPeriodDurationSeconds} abbreviation />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell background="secondary" alignSelf="stretch" />
      <SimpleTable.RowCell background="secondary" alignSelf="stretch" justify="end">
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
          <SimpleTable.RowCell paddingRight="0">
            <Placeholder height="24px" width="24px" />
          </SimpleTable.RowCell>
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
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="24px" />
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
