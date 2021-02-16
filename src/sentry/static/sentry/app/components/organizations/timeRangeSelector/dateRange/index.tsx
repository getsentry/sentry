import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';

import React from 'react';
import {DateRangePicker, OnChangeProps, RangeWithKey} from 'react-date-range';
import styled from '@emotion/styled';
import moment from 'moment';
import PropTypes from 'prop-types';

import Checkbox from 'app/components/checkbox';
import TimePicker from 'app/components/organizations/timeRangeSelector/timePicker';
import {MAX_PICKABLE_DAYS} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {LightWeightOrganization} from 'app/types';
import {analytics} from 'app/utils/analytics';
import {
  getEndOfDay,
  getStartOfPeriodAgo,
  isValidTime,
  setDateToTime,
} from 'app/utils/dates';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import theme from 'app/utils/theme';

const getTimeStringFromDate = (date: Date) => moment(date).local().format('HH:mm');

// react.date-range doesn't export this as a type.
type RangeSelection = {selection: RangeWithKey};

function isRangeSelection(maybe: OnChangeProps): maybe is RangeSelection {
  return (maybe as RangeSelection).selection !== undefined;
}

type ChangeData = {start?: Date; end?: Date; hasDateRangeErrors?: boolean};

const defaultProps = {
  showAbsolute: true,
  showRelative: false,
  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays: MAX_PICKABLE_DAYS,
};

type Props = {
  /**
   * Just used for metrics
   */
  organization: LightWeightOrganization;

  /**
   * Start date value for absolute date selector
   */
  start: Date | null;

  /**
   * End date value for absolute date selector
   */
  end: Date | null;

  /**
   * handle UTC checkbox change
   */
  onChangeUtc: () => void;

  /**
   * Callback when value changes
   */
  onChange: (data: ChangeData) => void;

  className?: string;
  /**
   * Should we have a time selector?
   */
  showTimePicker?: boolean;

  /**
   * Use UTC
   */
  utc?: boolean | null;
} & typeof defaultProps;

type State = {
  hasStartErrors: boolean;
  hasEndErrors: boolean;
};

class DateRange extends React.Component<Props, State> {
  static contextTypes = {
    router: PropTypes.object,
  };

  static defaultProps = defaultProps;

  state: State = {
    hasStartErrors: false,
    hasEndErrors: false,
  };

  handleSelectDateRange = (changeProps: OnChangeProps) => {
    if (!isRangeSelection(changeProps)) {
      return;
    }
    const {selection} = changeProps;
    const {onChange} = this.props;
    const {startDate, endDate} = selection;

    const end = endDate ? getEndOfDay(endDate) : endDate;

    onChange({
      start: startDate,
      end,
    });
  };

  handleChangeStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Safari does not support "time" inputs, so we don't have access to
    // `e.target.valueAsDate`, must parse as string
    //
    // Time will be in 24hr e.g. "21:00"
    const start = this.props.start ?? '';
    const end = this.props.end ?? undefined;
    const {onChange} = this.props;
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

  handleChangeEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = this.props.start ?? undefined;
    const end = this.props.end ?? '';
    const {onChange} = this.props;
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
    const {className, maxPickableDays, utc, showTimePicker, onChangeUtc} = this.props;
    const start = this.props.start ?? '';
    const end = this.props.end ?? '';

    const startTime = getTimeStringFromDate(new Date(start));
    const endTime = getTimeStringFromDate(new Date(end));

    // Restraints on the time range that you can select
    // Can't select dates in the future b/c we're not fortune tellers (yet)
    //
    // We want `maxPickableDays` - 1 (if today is Jan 5, max is 3 days, the minDate should be Jan 3)
    // Subtract additional day  because we force the end date to be inclusive,
    // so when you pick Jan 1 the time becomes Jan 1 @ 23:59:59,
    // (or really, Jan 2 @ 00:00:00 - 1 second), while the start time is at 00:00
    const minDate = getStartOfPeriodAgo('days', maxPickableDays - 2);
    const maxDate = new Date();

    return (
      <div className={className} data-test-id="date-range">
        <StyledDateRangePicker
          rangeColors={[theme.purple300]}
          ranges={[
            {
              startDate: moment(start).local().toDate(),
              endDate: moment(end).local().toDate(),
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
  border-left: 1px solid ${p => p.theme.border};
`;

const StyledDateRangePicker = styled(DateRangePicker)`
  padding: 21px; /* this is specifically so we can align borders */

  .rdrSelected,
  .rdrInRange,
  .rdrStartEdge,
  .rdrEndEdge {
    background-color: ${p => p.theme.active};
  }

  .rdrStartEdge + .rdrDayStartPreview {
    background-color: transparent;
  }

  .rdrDayNumber span {
    color: ${p => p.theme.textColor};
  }

  .rdrDayDisabled span {
    color: ${p => p.theme.subText};
  }

  .rdrDayToday .rdrDayNumber span {
    color: ${p => p.theme.active};
  }

  .rdrDayNumber span:after {
    background-color: ${p => p.theme.active};
  }

  .rdrDefinedRangesWrapper,
  .rdrDateDisplayWrapper,
  .rdrWeekDays {
    display: none;
  }

  .rdrInRange {
    background: ${p => p.theme.active};
  }

  .rdrDayInPreview {
    background: ${p => p.theme.focus};
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
    background-color: transparent;
    border: 1px solid ${p => p.theme.border};
  }

  .rdrPprevButton i {
    border-right-color: ${p => p.theme.textColor};
  }

  .rdrNextButton i {
    border-left-color: ${p => p.theme.textColor};
  }
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.gray300};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
`;

export default StyledDateRange;
