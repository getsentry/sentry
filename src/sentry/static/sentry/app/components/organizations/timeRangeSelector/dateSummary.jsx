/**
 * Displays and formats absolute DateTime ranges
 */

import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  DEFAULT_DAY_END_TIME,
  DEFAULT_DAY_START_TIME,
  getFormattedDate,
} from 'app/utils/dates';
import {t} from 'app/locale';
import space from 'app/styles/space';

class DateSummary extends React.Component {
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

    useUtc: PropTypes.bool,
  };

  formatDate(date) {
    return getFormattedDate(date, 'll', {local: !this.props.useUtc});
  }

  formatTime(date, withSeconds = false) {
    return getFormattedDate(date, `HH:mm${withSeconds ? ':ss' : ''}`, {
      local: !this.props.useUtc,
    });
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
      <Flex className={className} align="center">
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
      </Flex>
    );
  }
}

const DateGroup = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 110px;
`;

const Date = styled('div')`
  ${p => p.hasTime && 'margin-top: 10px'};
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const Time = styled('div')`
  font-size: 0.8em;
  line-height: 0.8em;
  opacity: 0.5;
`;

const DateRangeDivider = styled('span')`
  margin: 0 ${space(0.5)};
`;

export default DateSummary;
