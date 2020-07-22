import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import {DateRangePicker} from 'react-date-range';
import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {
  getEndOfDay,
  getStartOfPeriodAgo,
  isValidTime,
  setDateToTime,
} from 'app/utils/dates';
import {MAX_PICKABLE_DAYS} from 'app/constants';
import {t} from 'app/locale';
import Checkbox from 'app/components/checkbox';
import SentryTypes from 'app/sentryTypes';
import TimePicker from 'app/components/organizations/timeRangeSelector/timePicker';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

class DateRange extends React.Component {
  static getTimeStringFromDate = date =>
    moment(date)
      .local()
      .format('HH:mm');

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
     * The maximum number of days in the past you can pick
     */
    maxPickableDays: PropTypes.number,

    /**
     * Use UTC
     */
    utc: PropTypes.bool,

    /**
     * handle UTC checkbox change
     */
    onChangeUtc: PropTypes.func,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,

    /**
     * Just used for metrics
     */
    organization: SentryTypes.Organization,
  };

  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: false,
    maxPickableDays: MAX_PICKABLE_DAYS,
  };

  state = {
    hasStartErrors: false,
    hasEndErrors: false,
  };

  handleSelectDateRange = ({selection}) => {
    const {onChange} = this.props;
    const {startDate, endDate} = selection;

    const end = endDate ? getEndOfDay(endDate) : endDate;

    onChange({
      start: startDate,
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

    if (!startTime || !isValidTime(startTime)) {
      this.setState({hasStartErrors: true});
      onChange({hasDateRangeErrors: true});
      return;
    }
    const newTime = setDateToTime(start, startTime, {local: true});

    analytics('dateselector.time_changed', {
      field_changed: 'start',
      time: startTime,
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    onChange({
      start: newTime,
      end,
      hasDateRangeErrors: this.state.hasEndErrors,
    });

    this.setState({hasStartErrors: false});
  };

  handleChangeEnd = e => {
    const {start, end, onChange} = this.props;
    const endTime = e.target.value;

    if (!endTime || !isValidTime(endTime)) {
      this.setState({hasEndErrors: true});
      onChange({hasDateRangeErrors: true});
      return;
    }

    const newTime = setDateToTime(end, endTime, {local: true});

    analytics('dateselector.time_changed', {
      field_changed: 'end',
      time: endTime,
      path: getRouteStringFromRoutes(this.context.router.routes),
      org_id: parseInt(this.props.organization.id, 10),
    });

    onChange({
      start,
      end: newTime,
      hasDateRangeErrors: this.state.hasStartErrors,
    });

    this.setState({hasEndErrors: false});
  };

  render() {
    const {
      className,
      maxPickableDays,
      utc,
      start,
      end,
      showTimePicker,
      onChangeUtc,
    } = this.props;

    const startTime = DateRange.getTimeStringFromDate(new Date(start));
    const endTime = DateRange.getTimeStringFromDate(new Date(end));

    // Restraints on the time range that you can select
    // Can't select dates in the future b/c we're not fortune tellers (yet)
    //
    // We want `maxPickableDays` - 1 (if today is Jan 5, max is 3 days, the minDate should be Jan 3)
    // Subtract additional day  because we force the end date to be inclusive,
    // so when you pick Jan 1 the time becomes Jan 1 @ 23:59:59,
    // (or really, Jan 2 @ 00:00:00 - 1 second), while the start time is at 00:00
    const minDate = getStartOfPeriodAgo(maxPickableDays - 2, 'days');
    const maxDate = new Date();

    return (
      <div className={className} data-test-id="date-range">
        <StyledDateRangePicker
          rangeColors={[theme.purple400]}
          ranges={[
            {
              startDate: moment(start).local(),
              endDate: moment(end).local(),
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
                checked={utc || false}
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
  padding: 21px; /* this is specifically so we can align borders */

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
  .rdrDayStartOfWeek {
    .rdrInRange {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }
  }

  .rdrDayEndOfMonth,
  .rdrDayEndOfWeek {
    .rdrInRange {
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
    background-color: ${p => p.theme.gray300};
  }

  .rdrPprevButton i {
    border-right-color: ${p => p.theme.gray700};
  }

  .rdrNextButton i {
    border-left-color: ${p => p.theme.gray700};
  }
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.gray500};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
`;

export default StyledDateRange;
