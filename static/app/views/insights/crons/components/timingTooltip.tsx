import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import {Hovercard} from 'sentry/components/hovercard';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type CheckIn, CheckInStatus} from 'sentry/views/insights/crons/types';

interface TimingsTooltipProps {
  checkIn: CheckIn;
}

enum CompletionStatus {
  INCOMPLETE = 'incomplete',
  INCOMPLETE_TIMEOUT = 'Incomplete_timeout',
  COMPLETE = 'complete',
}

function getCompletionStatus({status, duration}: CheckIn) {
  // These are the terminal status's for the check-in
  const isUserComplete = [CheckInStatus.OK, CheckInStatus.ERROR].includes(status);
  const isTimeout = status === CheckInStatus.TIMEOUT;

  // Check-ins that are timed-out but have a duration indicate that we did
  // recieve a closing check-in, but it was too late.
  const isCompletedTimeout = isTimeout && duration !== null;

  // If we have a user sent terminal status we're definitely complete. We also
  // know we are complete if we have a timeout with a duration.
  if (isUserComplete || isCompletedTimeout) {
    return CompletionStatus.COMPLETE;
  }

  // A timeout without a duration means we never sent a closing check-in
  if (isTimeout) {
    return CompletionStatus.INCOMPLETE_TIMEOUT;
  }

  // Otherwise we have not sent a closing check-in yet
  return CompletionStatus.INCOMPLETE;
}

export function TimingsTooltip({checkIn}: TimingsTooltipProps) {
  const {dateAdded, dateUpdated, dateInProgress, dateCreated, dateClock, expectedTime} =
    checkIn;

  const [showSystemTiming, setShowSystemTiming] = useState(false);

  const updateDiff = moment(dateUpdated).diff(dateAdded, 'seconds');
  const lateBy = moment(dateAdded).diff(expectedTime, 'seconds');
  const completionStatus = getCompletionStatus(checkIn);

  const tooltipContent = (
    <Fragment>
      <TimingsList>
        <Timing>
          <TimingLabel>{t('Recorded')}</TimingLabel>
          <DateAndDifference>
            <DateTime date={dateAdded} timeZone seconds />
            {dateAdded !== expectedTime && moment(dateAdded).isAfter(expectedTime) ? (
              <Difference seconds={lateBy} abbreviation />
            ) : null}
          </DateAndDifference>
          <TimingDescription>
            {t('When the first check-in was received for this job.')}
          </TimingDescription>
        </Timing>
        <Timing>
          <TimingLabel>{t('In Progress')}</TimingLabel>
          <div>
            {dateInProgress ? (
              <Tag type="success">{t('Received')}</Tag>
            ) : (
              <Tag type="warning">{t('Not Sent')}</Tag>
            )}
          </div>
          <TimingDescription>
            {t(
              'These are optional, but without them, timeouts can’t be enforced, and long-running jobs may be marked as missed if their final check-in happens after the grace period.'
            )}
          </TimingDescription>
        </Timing>
        <Timing>
          <TimingLabel>{t('Completed')}</TimingLabel>
          <DateAndDifference>
            {completionStatus === CompletionStatus.COMPLETE ? (
              <Fragment>
                <DateTime date={dateUpdated} timeZone seconds />
                {dateUpdated !== dateAdded && (
                  <Difference abbreviation seconds={updateDiff} />
                )}
              </Fragment>
            ) : completionStatus === CompletionStatus.INCOMPLETE ? (
              <Tag type="default">{t('Incomplete')}</Tag>
            ) : completionStatus === CompletionStatus.INCOMPLETE_TIMEOUT ? (
              <Tag type="error">{t('Timed Out')}</Tag>
            ) : null}
          </DateAndDifference>
          <TimingDescription>
            {t(
              'When the final check-in was received, marking the job as completed or failed.'
            )}
          </TimingDescription>
        </Timing>
        {showSystemTiming && (
          <Fragment>
            <Timing>
              <TimingLabel>{t('Processed')}</TimingLabel>
              <DateTime date={dateCreated} timeZone seconds />
              <TimingDescription>
                {t(
                  'The true wall-clock time when Sentry processed this check-in. This may deviate slightly from the time the check-in was sent, Sentry will account for this during processing.'
                )}
              </TimingDescription>
            </Timing>
            <Timing>
              <TimingLabel>{t('Reference Time')}</TimingLabel>
              <DateTime date={dateClock} timeZone seconds />
              <TimingDescription>
                {t(
                  'The current reference "clock time" when the check-in was processed. Used to ensure check-ins are processed in-order as they are received '
                )}
              </TimingDescription>
            </Timing>
          </Fragment>
        )}
      </TimingsList>
      <AdvancedTimingButton
        size="xs"
        borderless
        onClick={() => setShowSystemTiming(s => !s)}
      >
        {showSystemTiming ? t('Hide System Timing') : t('See System Timing')}
      </AdvancedTimingButton>
    </Fragment>
  );

  return (
    <TimingsHovercard skipWrapper body={tooltipContent}>
      <IconInfo aria-label={t('More Details')} role="button" size="xs" />
    </TimingsHovercard>
  );
}

const TimingsHovercard = styled(Hovercard)`
  width: 350px;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const AdvancedTimingButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: normal;
  color: ${p => p.theme.subText};
`;

const TimingsList = styled('ul')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1.5)};
  margin: 0;
  padding: 0;
  margin-bottom: ${space(1)};
`;

const Timing = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  grid-template-rows: max-content max-content;
  align-items: center;
  grid-column: 1 / -1;
  gap: ${space(0.25)} ${space(1)};
  font-variant-numeric: tabular-nums;
`;

const TimingLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const TimingDescription = styled('p')`
  grid-column: 1 / -1;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const Difference = styled(Duration)`
  color: ${p => p.theme.warningText};
  &:before {
    content: '+';
  }
`;
const DateAndDifference = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
