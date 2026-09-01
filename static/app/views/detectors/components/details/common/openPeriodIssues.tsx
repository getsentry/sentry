import type {ComponentProps} from 'react';
import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {Duration} from 'sentry/components/duration';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {GroupStatusTag} from 'sentry/components/group/inboxBadges/groupStatusTag';
import {GroupHeaderRow} from 'sentry/components/groupHeaderRow';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import {DetailSection} from 'sentry/components/workflowEngine/ui/detailSection';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  buildDetectorZoomQuery,
  computeZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

const OPEN_PERIOD_COLUMNS: TableColumnConfig[] = [
  {key: 'issue', width: '1fr'},
  {key: 'status', width: 'min-content'},
  {key: 'lastSeen', width: 'auto'},
  {key: 'assignee', width: 'min-content'},
];

interface OpenPeriodsSubTableProps {
  groupId: string;
  onZoom: (start: Date, end?: Date) => void;
}

function OpenPeriodsSubTable({groupId, onZoom}: OpenPeriodsSubTableProps) {
  const location = useLocation();
  const start = location.query?.start as string | undefined;
  const end = location.query?.end as string | undefined;
  const statsPeriod = location.query?.statsPeriod as string | undefined;
  const dateParams = {start, end, statsPeriod};
  const {
    data: openPeriods,
    isPending: isOpenPeriodsPending,
    isError: isOpenPeriodsError,
  } = useOpenPeriods({groupId, ...dateParams});

  if (isOpenPeriodsPending) {
    return <OpenPeriodsSubTableSkeleton />;
  }

  if (isOpenPeriodsError) {
    return (
      <SubTable>
        <SmallEmptyState>{t('Failed to load open periods.')}</SmallEmptyState>
      </SubTable>
    );
  }

  if (!openPeriods?.length) {
    return (
      <SubTable>
        <SmallEmptyState>
          {t('No open periods within current date range.')}
        </SmallEmptyState>
      </SubTable>
    );
  }

  return (
    <SubTable>
      {openPeriods.map((period, idx) => {
        const openPeriodStart = new Date(period.start);
        const openPeriodEnd = period.end ? new Date(period.end) : undefined;
        const diffMs =
          (openPeriodEnd ?? new Date()).getTime() - openPeriodStart.getTime();
        const seconds = diffMs / 1000;
        return (
          <SimpleTable.Row key={`${period.start}-${idx}`}>
            <SimpleTable.RowCell>
              {/* TODO: Status Color */}
              <Text tabular>#{period.id}</Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                {t('Started')} <DateTime date={openPeriodStart} />
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Text>
                {openPeriodEnd ? (
                  <Fragment>
                    {t('Ended')} {openPeriodEnd ? <DateTime date={openPeriodEnd} /> : '—'}
                  </Fragment>
                ) : (
                  t('Ongoing')
                )}
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Duration seconds={seconds} abbreviation />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              <Button size="xs" onClick={() => onZoom(openPeriodStart, openPeriodEnd)}>
                {t('Zoom')}
              </Button>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SubTable>
  );
}

function OpenPeriodsSubTableSkeleton() {
  return (
    <SubTable>
      {[0, 1, 2].map(i => (
        <SimpleTable.Row key={i}>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="24px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="60%" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="40%" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="20px" width="50%" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell justify="end">
            <Placeholder height="24px" width="48px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </SubTable>
  );
}

function LatestGroupWithOpenPeriods({
  groupId,
  intervalSeconds,
}: {
  groupId: string;
  intervalSeconds?: number;
}) {
  const {data: group, isPending, isError} = useGroup({groupId});
  const location = useLocation();
  const navigate = useNavigate();

  const zoomToRange = useCallback(
    (start: Date, end?: Date) => {
      const startMs = start.getTime();
      const endMs = (end ?? new Date()).getTime();
      const zoomRange = computeZoomRangeMs({
        startMs,
        endMs,
        intervalSeconds,
      });
      navigate({
        pathname: location.pathname,
        query: buildDetectorZoomQuery(location.query, zoomRange),
      });
    },
    [location.pathname, location.query, navigate, intervalSeconds]
  );

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (!group || isError) {
    return (
      <SimpleTable>
        <SimpleTable.Empty>
          <EmptyStateWarning small>
            {t('Failed to load the latest issue')}
          </EmptyStateWarning>
        </SimpleTable.Empty>
      </SimpleTable>
    );
  }

  return (
    <SimpleTable
      columns={OPEN_PERIOD_COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Assignee')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      <SimpleTable.Row>
        <EventOrGroupCell>
          <GroupHeaderRow data={group} />
        </EventOrGroupCell>
        <SimpleTable.RowCell>
          <GroupStatusTag fontSize="md">{group.substatus ?? group.status}</GroupStatusTag>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <TimeAgoCell date={group.lastSeen} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <IssueAssigneeSelector group={group} />
        </SimpleTable.RowCell>
      </SimpleTable.Row>

      <SimpleTable.Row>
        <SimpleTable.RowCell
          align="stretch"
          column="1 / -1"
          direction="column"
          padding="0"
        >
          <OpenPeriodsSubTable groupId={group.id} onZoom={zoomToRange} />
        </SimpleTable.RowCell>
      </SimpleTable.Row>
    </SimpleTable>
  );
}

function IssueAssigneeSelector({group}: {group: Group}) {
  const organization = useOrganization();
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });

  return (
    <AssigneeSelector
      group={group}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
      showLabel
    />
  );
}

interface OngoingIssueProps {
  detector: Detector;
  /**
   * Helps the zoom function add padding on left and right of the open period.
   * If intervalSeconds is 24 hours, we would want a lot more padding than if it's 1 minute.
   */
  intervalSeconds?: number;
}

/**
 * Use this to display the list of issues for detectors which have open periods.
 */
export function DetectorDetailsOpenPeriodIssues({
  detector,
  intervalSeconds,
}: OngoingIssueProps) {
  const organization = useOrganization();
  const location = useLocation();
  // TODO: We'll probably need to make a query to get all linked issues
  const latestGroupId = detector.latestGroup?.id;
  const numIssues = latestGroupId ? 1 : 0;

  const issueSearchQueryParams = {
    query: `is:unresolved detector:${detector.id}`,
    limit: 5,
    start: location.query.start,
    end: location.query.end,
    statsPeriod: location.query.statsPeriod,
  };

  return (
    <DetailSection
      title={tn('Ongoing Issue', 'Ongoing Issues', numIssues)}
      trailingItems={
        <LinkButton
          size="xs"
          to={{
            pathname: `/organizations/${organization.slug}/issues/`,
            query: issueSearchQueryParams,
          }}
        >
          {t('View All')}
        </LinkButton>
      }
    >
      <ErrorBoundary mini>
        {latestGroupId ? (
          <LatestGroupWithOpenPeriods
            groupId={latestGroupId}
            intervalSeconds={intervalSeconds}
          />
        ) : (
          <SimpleTable>
            <SimpleTable.Empty>
              <EmptyStateWarning small withIcon={false}>
                {t('No ongoing issue found for this monitor')}
              </EmptyStateWarning>
            </SimpleTable.Empty>
          </SimpleTable>
        )}
      </ErrorBoundary>
    </DetailSection>
  );
}

const EventOrGroupCell = styled(SimpleTable.RowCell)`
  & > div {
    overflow: hidden;
  }
`;

const OPEN_PERIOD_SUB_COLUMNS: TableColumnConfig[] = [
  {key: 'id', width: 'min-content'},
  {key: 'started', width: '1fr'},
  {key: 'ended', width: '1fr'},
  {key: 'duration', width: '0.5fr'},
  {key: 'zoom', width: 'min-content'},
];

const StyledSubTable = styled(SimpleTable)`
  background-color: ${p => p.theme.tokens.background.secondary};
  border: 0;
`;

function SubTable(props: ComponentProps<typeof StyledSubTable>) {
  return <StyledSubTable columns={OPEN_PERIOD_SUB_COLUMNS} {...props} />;
}

const SmallEmptyState = styled(SimpleTable.Empty)`
  min-height: unset;
`;
