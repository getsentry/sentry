import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ShortId from 'sentry/components/shortId';
import {
  StatusIndicator,
  type StatusIndicatorProps,
} from 'sentry/components/statusIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import type {CheckIn, CheckInCellKey} from 'sentry/views/insights/crons/types';
import {CheckInStatus} from 'sentry/views/insights/crons/types';
import {statusToText} from 'sentry/views/insights/crons/utils';

import {DEFAULT_CHECKIN_MARGIN, DEFAULT_MAX_RUNTIME} from './monitorForm';

interface CheckInRowProps {
  cellKey: CheckInCellKey;
  checkIn: CheckIn;
  project: Project;
}

const checkStatusToIndicatorStatus: Record<
  CheckInStatus,
  StatusIndicatorProps['status']
> = {
  [CheckInStatus.OK]: 'success',
  [CheckInStatus.ERROR]: 'error',
  [CheckInStatus.IN_PROGRESS]: 'muted',
  [CheckInStatus.MISSED]: 'warning',
  [CheckInStatus.TIMEOUT]: 'error',
  [CheckInStatus.UNKNOWN]: 'muted',
};

const emptyCell = '\u2014';

/**
 * Represents the 'completion' of a check-in.
 */
enum CompletionStatus {
  /**
   * Check-in has not finished yet (an in-progress was received).
   */
  INCOMPLETE = 'incomplete',
  /**
   * Check-in was marked as timed out and never received a completing check-in.
   */
  INCOMPLETE_TIMEOUT = 'incomplete_timeout',
  /**
   * Check-in was marked as timed out and later received a user completing check-in.
   */
  COMPLETE_TIMEOUT = 'complete_timeout',
  /**
   * Check-in received a user terminal completion.
   */
  COMPLETE = 'complete',
}

function getCompletionStatus({status, duration}: CheckIn) {
  const isUserComplete = [CheckInStatus.OK, CheckInStatus.ERROR].includes(status);
  const isTimeout = status === CheckInStatus.TIMEOUT;

  // If we have a user sent terminal status we're definitely complete. We also
  // know we are complete if we have a timeout with a duration.
  if (isUserComplete) {
    return CompletionStatus.COMPLETE;
  }

  // Check-ins that are timed out but have a duration indicate that we did
  // receive a closing check-in, but it was too late.
  if (isTimeout && duration !== null) {
    return CompletionStatus.COMPLETE_TIMEOUT;
  }

  // A timeout without a duration means we never sent a closing check-in
  if (isTimeout) {
    return CompletionStatus.INCOMPLETE_TIMEOUT;
  }

  // Otherwise we have not sent a closing check-in yet
  return CompletionStatus.INCOMPLETE;
}

export function CheckInCell({cellKey, project, checkIn}: CheckInRowProps) {
  const organization = useOrganization();
  const {
    status,
    dateAdded,
    dateUpdated,
    dateInProgress,
    expectedTime,
    environment,
    duration,
    groups,
  } = checkIn;

  const statusText = statusToText[status];

  const statusColumn = (
    <Status>
      <StatusIndicator
        status={checkStatusToIndicatorStatus[status]}
        tooltipTitle={tct('Check-in Status: [statusText]', {statusText})}
      />
      {statusText}
    </Status>
  );

  const environmentColumn = <div>{environment}</div>;

  const expectedAtColumn = expectedTime ? (
    <TimestampContainer>
      <ExpectedDateTime date={expectedTime} timeZone seconds />
      <OffScheduleIndicator checkIn={checkIn} />
    </TimestampContainer>
  ) : (
    emptyCell
  );

  // Missed rows are mostly empty
  if (status === CheckInStatus.MISSED) {
    switch (cellKey) {
      case 'status':
        return statusColumn;
      case 'environment':
        return environmentColumn;
      case 'expectedAt':
        return expectedAtColumn;
      default:
        return emptyCell;
    }
  }

  const hadInProgress = !!dateInProgress;
  const completionStatus = getCompletionStatus(checkIn);

  const startedColumn = (
    <TimestampContainer>
      {hadInProgress ? (
        <DateTime date={dateAdded} timeZone seconds />
      ) : (
        <NotSentIndicator />
      )}
    </TimestampContainer>
  );

  const completedColumn = (
    <TimestampContainer>
      {completionStatus === CompletionStatus.COMPLETE ? (
        <DateTime date={dateUpdated} timeZone seconds />
      ) : completionStatus === CompletionStatus.COMPLETE_TIMEOUT && defined(duration) ? (
        <Fragment>
          <DateTime date={dateUpdated} timeZone seconds />
          <CompletedLateIndicator checkIn={checkIn} />
        </Fragment>
      ) : completionStatus === CompletionStatus.INCOMPLETE_TIMEOUT ? (
        <IncompleteTimeoutIndicator />
      ) : completionStatus === CompletionStatus.INCOMPLETE ? (
        <Tag type="default">{t('In Progress')}</Tag>
      ) : (
        emptyCell
      )}
    </TimestampContainer>
  );

  const durationColumn = defined(duration) ? (
    <DurationContainer>
      <Tooltip skipWrapper title={<Duration exact seconds={duration / 1000} />}>
        <Duration seconds={duration / 1000} />
      </Tooltip>
    </DurationContainer>
  ) : (
    emptyCell
  );

  const groupsColumn =
    groups && groups.length > 0 ? (
      <IssuesContainer>
        {groups.map(({id, shortId}) => (
          <QuickContextHovercard
            dataRow={{
              ['issue.id']: id,
              issue: shortId,
            }}
            contextType={ContextType.ISSUE}
            organization={organization}
            key={id}
          >
            <StyledShortId
              shortId={shortId}
              avatar={<ProjectBadge project={project} hideName avatarSize={12} />}
              to={`/organizations/${organization.slug}/issues/${id}/`}
            />
          </QuickContextHovercard>
        ))}
      </IssuesContainer>
    ) : (
      emptyCell
    );

  switch (cellKey) {
    case 'status':
      return statusColumn;
    case 'started':
      return startedColumn;
    case 'completed':
      return completedColumn;
    case 'duration':
      return durationColumn;
    case 'issues':
      return groupsColumn;
    case 'environment':
      return environmentColumn;
    case 'expectedAt':
      return expectedAtColumn;
    default:
      return emptyCell;
  }
}

interface OffScheduleIndicatorProps {
  checkIn: CheckIn;
}

/**
 * Renders a "Early" tag when the check-in occurred before it was expected.
 *
 * In scenarios where there is no in-progress and we know the duration of the
 * job, we can suggest the problem is the missing in-progress
 */
function OffScheduleIndicator({checkIn}: OffScheduleIndicatorProps) {
  const {duration, dateAdded, dateInProgress, expectedTime, monitorConfig} = checkIn;

  const durationSeconds = duration && duration / 1000;
  const marginSeconds = (monitorConfig.checkin_margin ?? DEFAULT_CHECKIN_MARGIN) * 60;

  const beforeExpected = moment(dateAdded).isBefore(expectedTime);

  // The check-in is on time if we're not checking-in before the expected
  // check-in time. If we are after the expected check-in time this means the
  // check-in happened before a miss was marked, and we are in the grace window.
  if (!beforeExpected) {
    return null;
  }

  const earlyBy = (
    <strong>
      <Duration seconds={moment(expectedTime).diff(dateAdded, 'seconds')} />
    </strong>
  );

  const checkInMargin = (
    <strong>
      <Duration seconds={marginSeconds} />
    </strong>
  );

  const jobDuration = durationSeconds && (
    <strong>
      <Duration seconds={durationSeconds} />
    </strong>
  );

  // If the check-in ran longer than the configured margin and we're missing an
  // in-progress check-in, it's very likely this check-in is off-schedule
  // because of the missing in-progress.
  const dueToMissingInProgress =
    durationSeconds && durationSeconds > marginSeconds && !dateInProgress;

  const title = dueToMissingInProgress
    ? tct(
        'This check-in was recorded [earlyBy] earlier than expected. This may be due to a missing in-progress check-in, as your job reported a duration of [jobDuration] without sending one. The grace period for your monitor before the check-in is considered missed is [checkInMargin].',
        {earlyBy, jobDuration, checkInMargin}
      )
    : tct(
        'This check-in was recorded [earlyBy] earlier than expected, which may indicate a configuration issue.',
        {earlyBy}
      );

  return (
    <Tooltip skipWrapper title={title}>
      <Tag type="error">{t('Early')}</Tag>
    </Tooltip>
  );
}

interface TimeoutLateByProps {
  checkIn: CheckIn;
}

/**
 * Renders a tag indicating how late the completing check-in was when a
 * check-in timed out but still has a duration (indicating we have a closing
 * check-in)
 */
function CompletedLateIndicator({checkIn}: TimeoutLateByProps) {
  const {duration, monitorConfig} = checkIn;

  if (duration === null) {
    return null;
  }

  const maxRuntimeSeconds = (monitorConfig.max_runtime ?? DEFAULT_MAX_RUNTIME) * 60;
  const lateBySecond = duration / 1000 - maxRuntimeSeconds;

  const maxRuntime = (
    <strong>
      <Duration seconds={maxRuntimeSeconds} />
    </strong>
  );

  const lateBy = (
    <strong>
      <Duration seconds={lateBySecond} />
    </strong>
  );

  const title = tct(
    'The closing check-in occurred [lateBy] after this check-in was marked as timed out. The configured maximum allowed runtime is [maxRuntime].',
    {lateBy, maxRuntime}
  );

  return (
    <Tooltip skipWrapper title={title}>
      <Tag type="error">
        {t('%s late', <Duration abbreviation seconds={lateBySecond} />)}
      </Tag>
    </Tooltip>
  );
}

/**
 * Renders an "Incomplete" badge, indicating the check-in never reported a
 * terminal completion status.
 */
function IncompleteTimeoutIndicator() {
  const title = t(
    'An in-progress check-in was received, but no closing check-in followed. Your job may be terminating before it reports to Sentry.'
  );

  return (
    <Tooltip skipWrapper title={title}>
      <Tag type="error">{t('Incomplete')}</Tag>
    </Tooltip>
  );
}

/**
 * Renders a "Not Sent" badge, indicating no in-progress check-in was sent.
 */
function NotSentIndicator() {
  const title = t(
    "No in-progress check-in was received. These are optional, but without them, timeouts can't be enforced, and long-running jobs may be marked as missed."
  );

  return (
    <Tooltip skipWrapper title={title}>
      <Tag type="warning">{t('Not Sent')}</Tag>
    </Tooltip>
  );
}

const Status = styled('div')`
  display: flex;
  align-items: center;
`;

const TimestampContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  font-variant-numeric: tabular-nums;
`;

const DurationContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const IssuesContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ExpectedDateTime = styled(DateTime)`
  color: ${p => p.theme.subText};
`;

const StyledShortId = styled(ShortId)`
  justify-content: flex-start;
`;
