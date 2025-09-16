import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {GroupStatusTag} from 'sentry/components/group/inboxBadges/groupStatusTag';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

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
              #ID_MISSING
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
            <SimpleTable.RowCell justify="flex-end">
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
          <SimpleTable.RowCell justify="flex-end">
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
  detector: Detector;
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

      // Default to 1 minute if intervalSeconds is not provided
      const intervalMs = Math.max((intervalSeconds ?? 60) * 1000, 60_000);
      const bufferMs = 10 * intervalMs; // show ~10 data points of context on each side

      // Desired symmetric range around the open period
      const desiredStart = startMs - bufferMs;
      const desiredEnd = endMs + bufferMs;

      // Clamp total span to avoid rendering more than 10k points or 90 days
      const MAX_POINTS = 10_000;
      const pointsSpanMs = MAX_POINTS * intervalMs;
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000; // 90 days
      const maxSpanMs = Math.min(pointsSpanMs, ninetyDaysMs);
      let zoomStartMs = desiredStart;
      let zoomEndMs = desiredEnd;
      if (zoomEndMs - zoomStartMs > maxSpanMs) {
        // Open periods can be longer than 90 days.
        // Prefer to show the end: clamp the window to the last maxSpanMs ending at desiredEnd
        zoomEndMs = desiredEnd;
        zoomStartMs = zoomEndMs - maxSpanMs;
      }

      const zoomStart = Math.floor(zoomStartMs / 60_000) * 60_000;
      const zoomEnd = Math.ceil(zoomEndMs / 60_000) * 60_000;
      navigate({
        pathname: location.pathname,
        query: {
          ...location.query,
          start: getUtcDateString(zoomStart),
          end: getUtcDateString(zoomEnd),
          statsPeriod: undefined,
        },
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
    <StyledTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Assignee')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>

      <SimpleTable.Row>
        <EventOrGroupCell>
          <EventOrGroupHeader data={group} />
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
        <div style={{gridColumn: '1 / -1', paddingTop: 0}}>
          <OpenPeriodsSubTable groupId={group.id} onZoom={zoomToRange} />
        </div>
      </SimpleTable.Row>
    </StyledTable>
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

export function DetectorDetailsOngoingIssues({
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
    <Section
      title={
        <Flex justify="between" align="center">
          {tn('Ongoing Issue', 'Ongoing Issues', numIssues)}
          <LinkButton
            size="xs"
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: issueSearchQueryParams,
            }}
          >
            {t('View All')}
          </LinkButton>
        </Flex>
      }
    >
      <ErrorBoundary mini>
        {latestGroupId ? (
          <LatestGroupWithOpenPeriods
            detector={detector}
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
    </Section>
  );
}

const EventOrGroupCell = styled(SimpleTable.RowCell)`
  & > div {
    overflow: hidden;
  }
`;

const StyledTable = styled(SimpleTable)`
  grid-template-columns: 1fr min-content auto min-content;
`;

const SubTable = styled(SimpleTable)`
  background-color: ${p => p.theme.backgroundSecondary};
  grid-template-columns: min-content 1fr 1fr 0.5fr min-content;
  border: 0;
`;

const SmallEmptyState = styled(SimpleTable.Empty)`
  min-height: unset;
`;
