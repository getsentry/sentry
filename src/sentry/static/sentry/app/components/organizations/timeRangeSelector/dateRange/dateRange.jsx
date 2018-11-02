import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {DateRangePicker} from 'react-date-range';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {
  getEarliestRetentionDate,
  getFormattedDate,
  getLocalDateObject,
  getUtcInLocal,
  setDateToTime,
} from 'app/utils/dates';
import {t} from 'app/locale';
import Checkbox from 'app/components/checkbox';
import TimePicker from 'app/components/organizations/timeRangeSelector/timePicker';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class DateRange extends React.Component {
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

    /**
     * Should we have a time selector?
     */
    showTimePicker: PropTypes.bool,

    /**
     * Use UTC
     */
    useUtc: PropTypes.bool,

    /**
     * handle UTC checkbox change
     */
    onChangeUtc: PropTypes.func,

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

  updateTime = (dateObj, timeStr) => {
    return setDateToTime(dateObj, timeStr || '00:00', {local: !this.props.useUtc});
  };

  handleSelectDateRange = ({selection}) => {
    const {useUtc, onChange} = this.props;
    const {startDate, endDate} = selection;

    let start = startDate;
    let end = endDate;

    if (start) {
      start = setDateToTime(start, '00:00', {local: !useUtc});
    }

    if (end) {
      end = setDateToTime(end, '00:00', {
        local: !useUtc,
      });
    }

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

    onChange({
      start: setDateToTime(start, startTime, {local: !this.props.useUtc}),
      end,
    });
  };

  handleChangeEnd = e => {
    const {start, end, onChange} = this.props;
    const endTime = e.target.value;

    onChange({
      start,
      end: setDateToTime(end, endTime, {local: !this.props.useUtc}),
    });
  };

  render() {
    const {className, useUtc, start, end, showTimePicker, onChangeUtc} = this.props;

    const startTime = DateRange.getTimeStringFromDate(new Date(start), useUtc);
    const endTime = DateRange.getTimeStringFromDate(new Date(end), useUtc);

    // Restraints on the time range that you can select
    // Can't select dates in the future b/c we're not fortune tellers (yet)
    const minDate = getEarliestRetentionDate();
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
        {showTimePicker && (
          <TimeAndUtcPicker>
            <TimePicker
              start={startTime}
              end={endTime}
              onChangeStart={this.handleChangeStart}
              onChangeEnd={this.handleChangeEnd}
            />
            <UtcPicker>
              {t('Use UTC')}
              <Checkbox
                onChange={onChangeUtc}
                checked={useUtc}
                style={{
                  margin: '0 0 0 0.5em',
                }}
              />
            </UtcPicker>
          </TimeAndUtcPicker>
        )}
      </div>
    );
  }
}

const StyledDateRange = styled(DateRange)`
  display: flex;
  flex-direction: column;
  border-left: 1px solid ${p => p.theme.borderLight};
`;

const StyledDateRangePicker = styled(DateRangePicker)`
  padding: ${p => space(2)};

  .rdrDefinedRangesWrapper,
  .rdrDateDisplayWrapper,
  .rdrWeekDays {
    display: none;
  }

  .rdrMonth {
    width: 300px;
    font-size: 1.2em;
    padding: 0;
  }

  .rdrStartEdge {
    border-top-left-radius: 1.14em;
    border-bottom-left-radius: 1.14em;
  }

  .rdrEndEdge {
    border-top-right-radius: 1.14em;
    border-bottom-right-radius: 1.14em;
  }

  .rdrDayStartPreview,
  .rdrDayEndPreview,
  .rdrDayInPreview {
    border: 0;
    background: rgba(200, 200, 200, 0.3);
  }

  .rdrDayStartOfMonth,
  .rdrDayStartOfMonth,
  .rdrDayStartOfWeek,
  .rdrDayStartOfWeek {
    .rdrInRange,
    .rdrEndEdge {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  .rdrDayEndOfMonth,
  .rdrDayEndOfMonth,
  .rdrDayEndOfWeek,
  .rdrDayEndOfWeek {
    .rdrInRange,
    .rdrEndEdge {
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
    }
  }

  .rdrStartEdge.rdrEndEdge {
    border-radius: 1.14em;
  }

  .rdrMonthAndYearWrapper {
    padding-bottom: ${space(1)};
    padding-top: 0;
    height: 32px;
  }

  .rdrDay {
    height: 2.5em;
  }

  .rdrMonthPicker select,
  .rdrYearPicker select {
    background: none;
    font-weight: normal;
    font-size: 16px;
    padding: 0;
  }

  .rdrMonthsVertical {
    align-items: center;
  }

  .rdrCalendarWrapper {
    flex: 1;
  }

  .rdrNextPrevButton {
    background-color: ${p => p.theme.offWhite2};
  }

  .rdrPprevButton i {
    border-right-color: ${p => p.theme.gray4};
  }

  .rdrNextButton i {
    border-left-color: ${p => p.theme.gray4};
  }
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  padding: ${p => space(2)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.gray2};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
`;

export default StyledDateRange;
