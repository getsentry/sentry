import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Tag} from 'sentry/components/core/badge/tag';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ShortId from 'sentry/components/shortId';
import {
  StatusIndicator,
  type StatusIndicatorProps,
} from 'sentry/components/statusIndicator';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import type {CheckIn, CheckInCellKey} from 'sentry/views/insights/crons/types';
import {CheckInStatus} from 'sentry/views/insights/crons/types';
import {statusToText} from 'sentry/views/insights/crons/utils';

import {DEFAULT_CHECKIN_MARGIN, DEFAULT_MAX_RUNTIME} from './monitorForm';

/**
 * How many seconds can a check-in have been stuck in Relay before being
 * considered to have "high latency", at which point we'll show an indicator on
 * the check-in row.
 */
const HIGH_LATENCY_CUTOFF = 60;

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
  [CheckInStatus.ERROR]: 'danger',
  [CheckInStatus.IN_PROGRESS]: 'muted',
  [CheckInStatus.MISSED]: 'warning',
  [CheckInStatus.TIMEOUT]: 'danger',
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
    id,
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
    <Flex align="center">
      <StatusIndicator
        status={checkStatusToIndicatorStatus[status]}
        tooltipTitle={tct('Check-in Status: [statusText]', {statusText})}
      />
      {statusText}
    </Flex>
  );

  const environmentColumn = <div>{environment}</div>;

  const expectedAtColumn = expectedTime ? (
    <TimestampContainer>
      <ExpectedDateTime date={expectedTime} timeZone seconds />
      <OffScheduleIndicator checkIn={checkIn} />
      <ProcessingLatencyIndicator checkIn={checkIn} />
    </TimestampContainer>
  ) : (
    emptyCell
  );

  const checkInIdColumn = (
    <Flex gap="md">
      <ShortId shortId={getShortEventId(id)} />
      <CopyToClipboardButton
        size="zero"
        borderless
        text={id.replaceAll('-', '')}
        title={t('Copy full check-in identifier')}
        aria-label={t('Copy Check-In ID')}
      />
    </Flex>
  );

  // Missed rows are mostly empty
  if (status === CheckInStatus.MISSED) {
    switch (cellKey) {
      case 'status':
        return statusColumn;
      case 'environment':
        return environmentColumn;
      case 'checkInId':
        return checkInIdColumn;
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
    <Flex align="center">
      <Tooltip skipWrapper title={<Duration exact seconds={duration / 1000} />}>
        <Duration seconds={duration / 1000} />
      </Tooltip>
    </Flex>
  ) : (
    emptyCell
  );

  const groupsColumn =
    groups && groups.length > 0 ? (
      <IssuesContainer>
        {groups.map(({id: groupId, shortId}) => (
          <QuickContextHovercard
            dataRow={{
              ['issue.id']: groupId,
              issue: shortId,
            }}
            contextType={ContextType.ISSUE}
            organization={organization}
            key={groupId}
          >
            <StyledShortId
              shortId={shortId}
              avatar={<ProjectBadge project={project} hideName avatarSize={12} />}
              to={`/organizations/${organization.slug}/issues/${groupId}/`}
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
    case 'checkInId':
      return checkInIdColumn;
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
 * Computes the timeout check-ins lateBySeconds, this is how much longer the
 * check-in ran past it's max runtime. Also returns the maxRuntimeSeconds. This
 * is computed from the monitor config at the time of the check-inAlso returns
 * the maxRuntimeSeconds. This is computed from the monitor config at the time
 * of the check-in
 */
function computeTimeoutMetrics({status, duration, monitorConfig}: CheckIn) {
  // metrics are only valid for check-ins that timed out
  if (status !== CheckInStatus.TIMEOUT) {
    return null;
  }

  // metrics are only valid for timed out check-ins with a duraiton
  if (duration === null) {
    return null;
  }

  const maxRuntimeSeconds = (monitorConfig.max_runtime ?? DEFAULT_MAX_RUNTIME) * 60;
  const lateBySeconds = duration / 1000 - maxRuntimeSeconds;

  return {maxRuntimeSeconds, lateBySeconds};
}

/**
 * In cases where a check-in was processed late due to being stuck in relay we
 * may compute a negative lateBySeconds.
 *
 * This happens because the check-in is marked as timed out, later we receive a
 * completing check-in that updates the duration. Typically this would imply
 * the check-in ran too long. But if the duration is less than the max-runtine,
 * it implies the check-in was produced to kafka much later than it should
 * have, and the job actually ran like normal
 */
function isAbnormalLate(lateBySeconds: number) {
  return lateBySeconds < 0;
}

/**
 * Renders a tag indicating how late the completing check-in was when a
 * check-in timed out but still has a duration (indicating we have a closing
 * check-in)
 */
function CompletedLateIndicator({checkIn}: TimeoutLateByProps) {
  const metrics = computeTimeoutMetrics(checkIn);

  if (metrics === null) {
    return null;
  }

  const {maxRuntimeSeconds, lateBySeconds} = metrics;

  // See comment on isAbnormalLate for this case
  if (isAbnormalLate(lateBySeconds)) {
    return null;
  }

  const maxRuntime = (
    <strong>
      <Duration seconds={maxRuntimeSeconds} />
    </strong>
  );

  const lateBy = (
    <strong>
      <Duration seconds={lateBySeconds} />
    </strong>
  );

  const title = tct(
    'The closing check-in occurred [lateBy] after this check-in was marked as timed out. The configured maximum allowed runtime is [maxRuntime].',
    {lateBy, maxRuntime}
  );

  return (
    <Tooltip skipWrapper title={title}>
      <Tag type="error">
        {t('%s late', <Duration abbreviation seconds={lateBySeconds} />)}
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

interface ProcessingLatencyProps {
  checkIn: CheckIn;
}

/**
 * Renders a slow processing indicator to inform the user that we took a long
 * time to process this check-in.
 */
function ProcessingLatencyIndicator({checkIn}: ProcessingLatencyProps) {
  const {dateClock, dateAdded, status} = checkIn;

  // Check-ins that have a high latency, the time between the dateAdded (the
  // time the opening check-in was received by relay) and the dateClock (the
  // reference time at the point the check-in was placed in kafka), indicates
  // that the check-in spent a long time in relay.
  //
  // Right now there's little we can do to correct for this, so as a best
  // effort to help the user understand that there was a problem.
  const processingLatency = moment(dateClock).diff(dateAdded, 'seconds');
  const hasProcessingLatency =
    status !== CheckInStatus.MISSED && processingLatency >= HIGH_LATENCY_CUTOFF;

  // Timned out check-ins that have abnormal "lateBySeconds" metrics indicate
  // the completing check-in was stuck in relay.
  const timeoutMetrics = computeTimeoutMetrics(checkIn);
  const abnormalLateCheckIn =
    timeoutMetrics && isAbnormalLate(timeoutMetrics.lateBySeconds);

  if (!hasProcessingLatency && !abnormalLateCheckIn) {
    return null;
  }

  // Different tooltips for different scenarios
  const tooltipMessage = hasProcessingLatency
    ? t(
        'This check-in was processed late due to abnormal system latency in Sentry. The status of this check-in may be inaccurate.'
      )
    : t(
        'This check-in was incorrectly marked as timed-out. The check-in was processed late due to abnormal system latency in Sentry.'
      );

  return <QuestionTooltip icon="info" size="sm" title={tooltipMessage} />;
}

const TimestampContainer = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  font-variant-numeric: tabular-nums;
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
