/**
 * Displays and formats absolute DateTime ranges
 */

import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {getFormattedDate, isSameDay} from 'app/utils/dates';
import {t} from 'app/locale';
import space from 'app/styles/space';

const MIDNIGHT = '00:00';

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

  formatTime(date) {
    return getFormattedDate(date, 'HH:mm', {local: !this.props.useUtc});
  }

  render() {
    const {className, start, end} = this.props;
    const startTimeFormatted = this.formatTime(start);
    const endTimeFormatted = this.formatTime(end);

    // Show times if either start or end date contain a time that is not midnight
    const shouldShowTimes =
      startTimeFormatted !== MIDNIGHT || endTimeFormatted !== MIDNIGHT;

    const shouldShowEndDateTime = !isSameDay(start, end);

    return (
      <Flex className={className} align="center">
        <DateGroup>
          <Date hasTime={shouldShowTimes}>{this.formatDate(start)}</Date>
          {shouldShowTimes && <Time>{this.formatTime(start)}</Time>}
        </DateGroup>
        {shouldShowEndDateTime && (
          <React.Fragment>
            <DateRangeDivider>{t('to')}</DateRangeDivider>

            <DateGroup>
              <Date hasTime={shouldShowTimes}>{this.formatDate(end)}</Date>
              {shouldShowTimes && <Time>{this.formatTime(end)}</Time>}
            </DateGroup>
          </React.Fragment>
        )}
      </Flex>
    );
  }
}

const DateGroup = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
`;

const Date = styled('span')`
  ${p => p.hasTime && 'margin-top: 12px'};
`;

const Time = styled('span')`
  font-size: 0.8em;
  line-height: 0.8em;
  opacity: 0.5;
`;

const DateRangeDivider = styled('span')`
  margin: 0 ${space(1)};
`;

export default DateSummary;
