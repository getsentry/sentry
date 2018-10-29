import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {DateRangePicker} from 'react-date-range';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {
  getFormattedDate,
  getLocalDateObject,
  getUtcInLocal,
  setDateToTime,
} from 'app/utils/dates';
import TimePicker from 'app/components/organizations/timeRangeSelector/timePicker';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const DateRange = styled(
  class DateRange extends React.Component {
    static propTypes = {
      /**
       * Start date value for absolute date selector
       */
      start: PropTypes.instanceOf(Date),
      /**
       * End date value for absolute date selector
       */
      end: PropTypes.instanceOf(Date),

      /**
       * Should we have a time selector?
       */
      allowTimePicker: PropTypes.bool,

      /**
       * Use UTC
       */
      useUtc: PropTypes.bool,

      /**
       * Callback when value changes
       */
      onChange: PropTypes.func,
    };

    static defaultProps = {
      showAbsolute: true,
      showRelative: false,
    };

    static getTimeStringFromDate = (date, useUtc) => {
      return getFormattedDate(date, 'HH:mm', {local: !useUtc});
    };

    constructor(props) {
      super(props);
      this.state = {};
    }

    handleChangeTime = () => {};

    updateTime = (dateObj, timeStr) => {
      return setDateToTime(dateObj, timeStr || '00:00', {local: !this.props.useUtc});
    };

    handleSelectDateRange = ({selection}) => {
      const {onChange} = this.props;
      const {startTime, endTime} = this.state;
      const {startDate, endDate} = selection;

      let start = startDate;
      let end = endDate;

      if (start) {
        start = setDateToTime(start, startTime || '00:00', {local: !this.props.useUtc});
      }
      if (end) {
        end = setDateToTime(end, endTime || startTime || '00:00', {
          local: !this.props.useUtc,
        });
      }

      // overwrite selection dates's times with times in state
      onChange({
        start,
        end,
      });
    };

    handleChangeStart = e => {
      // Safari does not support "time" inputs, so we don't have access to
      // `e.target.valueAsDate`, must parse as string
      //
      // Time will be in 24hr e.g. "21:00"
      const {start, end, onChange} = this.props;
      const startTime = e.target.value;

      if (!start) {
        this.setState({
          startTime,
        });
        return;
      }

      onChange({
        start: setDateToTime(start, startTime, {local: !this.props.useUtc}),
        end,
      });
    };

    handleChangeEnd = e => {
      const {start, end, onChange} = this.props;
      const endTime = e.target.value;
      if (!end) {
        this.setState({
          endTime,
        });
        return;
      }

      onChange({
        start,
        end: setDateToTime(end, endTime, {local: !this.props.useUtc}),
      });
    };

    render() {
      const {className, start, end, useUtc, allowTimePicker} = this.props;

      const startTime = DateRange.getTimeStringFromDate(new Date(start), useUtc);
      const endTime = DateRange.getTimeStringFromDate(new Date(end), useUtc);
      const minDate = moment()
        .subtract(90, 'days')
        .toDate();
      const maxDate = new Date();

      return (
        <div className={className}>
          <StyledDateRangePicker
            rangeColors={[theme.purple]}
            ranges={[
              {
                startDate: start
                  ? useUtc ? getUtcInLocal(start) : getLocalDateObject(start)
                  : start,
                endDate: end
                  ? useUtc ? getUtcInLocal(end) : getLocalDateObject(end)
                  : end,
                key: 'selection',
              },
            ]}
            minDate={minDate}
            maxDate={maxDate}
            onChange={this.handleSelectDateRange}
          />
          {allowTimePicker && (
            <TimePicker
              disabled={!start && !end}
              start={startTime}
              end={endTime}
              onChangeStart={this.handleChangeStart}
              onChangeEnd={this.handleChangeEnd}
            />
          )}
        </div>
      );
    }
  }
)`
  display: flex;
  flex-direction: column;
  border-left: 1px solid ${p => p.theme.borderLight};
`;

const StyledDateRangePicker = styled(DateRangePicker)`
  .rdrMonthAndYearWrapper {
    padding-top: ${space(1)};
  }
  .rdrMonth {
    padding: 0;
  }
  .rdrDefinedRangesWrapper {
    display: none;
  }
  .rdrMonthsVertical {
    align-items: center;
  }
  .rdrCalendarWrapper {
    flex: 1;
  }
`;

export default DateRange;
