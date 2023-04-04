import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DEFAULT_DAY_END_TIME, DEFAULT_DAY_START_TIME} from 'sentry/utils/dates';

type Props = {
  end: moment.MomentInput;
  start: moment.MomentInput;
};

/**
 * Displays and formats absolute DateTime ranges
 */
const DateSummary = ({start, end}: Props) => {
  function getFormattedDate(date: moment.MomentInput, format: string) {
    return moment(date).local().format(format);
  }

  function formatDate(date: moment.MomentInput) {
    return getFormattedDate(date, 'll');
  }

  function formatTime(date: moment.MomentInput, withSeconds = false) {
    return getFormattedDate(date, `HH:mm${withSeconds ? ':ss' : ''}`);
  }

  const startTimeFormatted = formatTime(start, true);
  const endTimeFormatted = formatTime(end, true);

  // Show times if either start or end date contain a time that is not midnight
  const shouldShowTimes =
    startTimeFormatted !== DEFAULT_DAY_START_TIME ||
    endTimeFormatted !== DEFAULT_DAY_END_TIME;

  return (
    <DateGroupWrapper hasTime={shouldShowTimes}>
      <DateGroup>
        <Date hasTime={shouldShowTimes}>
          {formatDate(start)}
          {shouldShowTimes && <Time>{formatTime(start)}</Time>}
        </Date>
      </DateGroup>
      <Fragment>
        <DateRangeDivider>{t('to')}</DateRangeDivider>

        <DateGroup>
          <Date hasTime={shouldShowTimes}>
            {formatDate(end)}
            {shouldShowTimes && <Time>{formatTime(end)}</Time>}
          </Date>
        </DateGroup>
      </Fragment>
    </DateGroupWrapper>
  );
};

const DateGroupWrapper = styled('div')<{hasTime: boolean}>`
  display: flex;
  align-items: center;
  transform: translateY(${p => (p.hasTime ? '-5px' : '0')});
`;

const DateGroup = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 110px;
`;

const Date = styled('div')<{hasTime: boolean}>`
  ${p => p.hasTime && 'margin-top: 9px'};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const Time = styled('div')`
  font-size: 0.7em;
  line-height: 0.7em;
  opacity: 0.5;
`;

const DateRangeDivider = styled('span')`
  margin: 0 ${space(0.5)};
`;

export default DateSummary;
