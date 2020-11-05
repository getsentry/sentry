/**
 * Displays and formats absolute DateTime ranges
 */
import React from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {DEFAULT_DAY_END_TIME, DEFAULT_DAY_START_TIME} from 'app/utils/dates';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  start: moment.MomentInput;
  end: moment.MomentInput;
};

class DateSummary extends React.Component<Props> {
  getFormattedDate(date: moment.MomentInput, format: string) {
    return moment(date).local().format(format);
  }

  formatDate(date: moment.MomentInput) {
    return this.getFormattedDate(date, 'll');
  }

  formatTime(date: moment.MomentInput, withSeconds = false) {
    return this.getFormattedDate(date, `HH:mm${withSeconds ? ':ss' : ''}`);
  }

  render() {
    const {start, end} = this.props;
    const startTimeFormatted = this.formatTime(start, true);
    const endTimeFormatted = this.formatTime(end, true);

    // Show times if either start or end date contain a time that is not midnight
    const shouldShowTimes =
      startTimeFormatted !== DEFAULT_DAY_START_TIME ||
      endTimeFormatted !== DEFAULT_DAY_END_TIME;

    return (
      <DateGroupWrapper hasTime={shouldShowTimes}>
        <DateGroup>
          <Date hasTime={shouldShowTimes}>
            {this.formatDate(start)}
            {shouldShowTimes && <Time>{this.formatTime(start)}</Time>}
          </Date>
        </DateGroup>
        <React.Fragment>
          <DateRangeDivider>{t('to')}</DateRangeDivider>

          <DateGroup>
            <Date hasTime={shouldShowTimes}>
              {this.formatDate(end)}
              {shouldShowTimes && <Time>{this.formatTime(end)}</Time>}
            </Date>
          </DateGroup>
        </React.Fragment>
      </DateGroupWrapper>
    );
  }
}

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
