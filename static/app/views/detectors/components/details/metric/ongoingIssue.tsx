import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
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
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeAgoCell} from 'sentry/components/workflowEngine/gridCell/timeAgoCell';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

interface OngoingIssueProps {
  detector: MetricDetector;
}

export function MetricDetectorDetailsOngoingIssue({detector}: OngoingIssueProps) {
  const latestGroupId = detector.latestGroup?.id;
  const dataSource = detector.dataSources[0];
  const intervalSeconds = dataSource.queryObj?.snubaQuery.timeWindow;

  return (
    <Section title={t('Ongoing Issue')}>
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
    </Section>
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
      // Use detector interval to determine context
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

  const openPeriods = group.openPeriods ?? [];

  return (
    <StyledTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Age')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Assignee')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>

      <SimpleTable.Row>
        <SimpleTable.RowCell>
          <EventOrGroupHeader data={group} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <GroupStatusTag fontSize="md">{group.substatus ?? group.status}</GroupStatusTag>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <TimeAgoCell date={group.firstSeen} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <IssueAssigneeSelector group={group} />
        </SimpleTable.RowCell>
      </SimpleTable.Row>

      <SimpleTable.Row>
        <div style={{gridColumn: '1 / -1', paddingTop: 0}}>
          {openPeriods.length === 0 ? (
            <SubTable>
              <SimpleTable.Empty>{t('No open periods')}</SimpleTable.Empty>
            </SubTable>
          ) : (
            <SubTable>
              {openPeriods.map((period, idx) => {
                const start = new Date(period.start);
                const end = period.end ? new Date(period.end) : undefined;
                const seconds = Math.floor(
                  ((end ?? new Date()).getTime() - start.getTime()) / 1000
                );
                return (
                  <SimpleTable.Row key={`${period.start}-${idx}`}>
                    <SimpleTable.RowCell>
                      {/* TODO: Status Color */}
                      #id missing
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <div>
                        {t('Started')} <DateTime date={start} />
                      </div>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      {end ? (
                        <div>
                          {t('Ended')} {end ? <DateTime date={end} /> : '—'}
                        </div>
                      ) : (
                        t('Ongoing')
                      )}
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell>
                      <Duration
                        seconds={seconds}
                        precision="minutes"
                        abbreviation
                        exact
                      />
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="flex-end">
                      <Button size="xs" onClick={() => zoomToRange(start, end)}>
                        {t('Zoom')}
                      </Button>
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                );
              })}
            </SubTable>
          )}
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

const StyledTable = styled(SimpleTable)`
  grid-template-columns: 1fr 160px 156px 240px;
`;

const SubTable = styled(SimpleTable)`
  background-color: ${p => p.theme.backgroundSecondary};
  grid-template-columns: 0.5fr 1fr 1fr 160px min-content;
  border: 0;
`;

export default MetricDetectorDetailsOngoingIssue;
