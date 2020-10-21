/**
 * Displays and formats absolute DateTime ranges
 */
import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {DEFAULT_DAY_END_TIME, DEFAULT_DAY_START_TIME} from 'app/utils/dates';
import {t} from 'app/locale';
import space from 'app/styles/space';

class DateSummary extends Component {
  static propTypes = {
    /**
     * Start date value for absolute date selector
     * Accepts a JS Date or a moment object
     *
     * React does not support `instanceOf` with null values
     */
    start: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),

    /**
     * End date value for absolute date selector
     * Accepts a JS Date or a moment object
     *
     * React does not support `instanceOf` with null values
     */
    end: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  };

  getFormattedDate(date, format) {
    return moment(date).local().format(format);
  }

  formatDate(date) {
    return this.getFormattedDate(date, 'll');
  }

  formatTime(date, withSeconds = false) {
    return this.getFormattedDate(date, `HH:mm${withSeconds ? ':ss' : ''}`);
  }

  render() {
    const {className, start, end} = this.props;
    const startTimeFormatted = this.formatTime(start, true);
    const endTimeFormatted = this.formatTime(end, true);

    // Show times if either start or end date contain a time that is not midnight
    const shouldShowTimes =
      startTimeFormatted !== DEFAULT_DAY_START_TIME ||
      endTimeFormatted !== DEFAULT_DAY_END_TIME;

    return (
      <DateGroupWrapper className={className} hasTime={shouldShowTimes}>
        <DateGroup>
          <Date hasTime={shouldShowTimes}>
            {this.formatDate(start)}
            {shouldShowTimes && <Time>{this.formatTime(start)}</Time>}
          </Date>
        </DateGroup>
        <Fragment>
          <DateRangeDivider>{t('to')}</DateRangeDivider>

          <DateGroup>
            <Date hasTime={shouldShowTimes}>
              {this.formatDate(end)}
              {shouldShowTimes && <Time>{this.formatTime(end)}</Time>}
            </Date>
          </DateGroup>
        </Fragment>
      </DateGroupWrapper>
    );
  }
}

const DateGroupWrapper = styled('div')`
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

const Date = styled('div')`
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
