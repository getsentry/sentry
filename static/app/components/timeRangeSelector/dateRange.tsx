import {Component} from 'react';
import type {Range} from 'react-date-range';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateRangePicker} from 'sentry/components/calendar';
import Checkbox from 'sentry/components/checkbox';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getEndOfDay,
  getStartOfPeriodAgo,
  isValidTime,
  setDateToTime,
} from 'sentry/utils/dates';
import domId from 'sentry/utils/domId';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import TimePicker from './timePicker';

const getTimeStringFromDate = (date: Date) => moment(date).local().format('HH:mm');

type ChangeData = {end?: Date; hasDateRangeErrors?: boolean; start?: Date};

const defaultProps = {
  showAbsolute: true,
  showRelative: false,
  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays: MAX_PICKABLE_DAYS,
};

type Props = WithRouterProps & {
  /**
   * End date value for absolute date selector
   */
  end: Date | null;
  /**
   * Callback when value changes
   */
  onChange: (data: ChangeData) => void;

  /**
   * handle UTC checkbox change
   */
  onChangeUtc: () => void;

  /**
   * Start date value for absolute date selector
   */
  start: Date | null;

  theme: Theme;

  className?: string;

  /**
   * The largest date range (ie. end date - start date) allowed
   */
  maxDateRange?: number;

  /**
   * Just used for metrics
   */
  organization?: Organization;

  /**
   * Should we have a time selector?
   */
  showTimePicker?: boolean;

  /**
   * Use UTC
   */
  utc?: boolean | null;
} & Partial<typeof defaultProps>;

type State = {
  hasEndErrors: boolean;
  hasStartErrors: boolean;
};

class BaseDateRange extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    hasStartErrors: false,
    hasEndErrors: false,
  };

  private readonly utcInputId = domId('utc-picker-');

  handleSelectDateRange = (range: Range) => {
    const {onChange} = this.props;
    const {startDate, endDate} = range;
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
    const {onChange, organization, router} = this.props;
    const startTime = e.target.value;
    const newStartTime = setDateToTime(start, startTime, {local: true});

    if (!startTime || !isValidTime(startTime) || (end && newStartTime > end)) {
      this.setState({hasStartErrors: true});
      onChange({hasDateRangeErrors: true});
      return;
    }

    trackAnalytics('dateselector.time_changed', {
      organization: organization ?? null,
      field_changed: 'start',
      time: startTime,
      path: getRouteStringFromRoutes(router.routes),
    });

    onChange({
      start: newStartTime,
      end,
      hasDateRangeErrors: this.state.hasEndErrors,
    });

    this.setState({hasStartErrors: false});
  };

  handleChangeEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const start = this.props.start ?? undefined;
    const end = this.props.end ?? '';
    const {organization, onChange, router} = this.props;
    const endTime = e.target.value;
    const newEndTime = setDateToTime(end, endTime, {local: true});

    if (!endTime || !isValidTime(endTime) || (start && start > newEndTime)) {
      this.setState({hasEndErrors: true});
      onChange({hasDateRangeErrors: true});
      return;
    }

    trackAnalytics('dateselector.time_changed', {
      organization: organization ?? null,
      field_changed: 'end',
      time: endTime,
      path: getRouteStringFromRoutes(router.routes),
    });

    onChange({
      start,
      end: newEndTime,
      hasDateRangeErrors: this.state.hasStartErrors,
    });

    this.setState({hasEndErrors: false});
  };

  render() {
    const {className, maxPickableDays, utc, showTimePicker, onChangeUtc, maxDateRange} =
      this.props;
    const {hasStartErrors, hasEndErrors} = this.state;
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
    let minDate = getStartOfPeriodAgo('days', (maxPickableDays ?? MAX_PICKABLE_DAYS) - 1);

    let maxDate = new Date();

    // if the start and end date are the same, it means the user can still select another date,
    // at this point we want to apply the maxDateRange
    const startDate = moment(start).local();
    const endDate = moment(end).local();
    const isSameDay = startDate.isSame(endDate, 'day');
    if (maxDateRange && isSameDay) {
      minDate = moment(new Date(start)).subtract(maxDateRange, 'days').toDate();
      const newMaxDate = moment(new Date(end)).add(maxDateRange, 'days').toDate();
      maxDate = newMaxDate > maxDate ? maxDate : newMaxDate;
    }

    return (
      <div className={className} data-test-id="date-range">
        <DateRangePicker
          startDate={startDate.toDate()}
          endDate={endDate.toDate()}
          minDate={minDate}
          maxDate={maxDate}
          onChange={this.handleSelectDateRange}
        />
        {showTimePicker && (
          <TimeAndUtcPicker>
            <StyledTimePicker
              start={startTime}
              end={endTime}
              onChangeStart={this.handleChangeStart}
              onChangeEnd={this.handleChangeEnd}
              hasStartErrors={hasStartErrors}
              hasEndErrors={hasEndErrors}
            />
            <UtcPicker>
              <Checkbox
                onChange={onChangeUtc}
                checked={utc || false}
                id={this.utcInputId}
              />
              <UtcPickerLabel htmlFor={this.utcInputId}>{t('UTC')}</UtcPickerLabel>
            </UtcPicker>
          </TimeAndUtcPicker>
        )}
      </div>
    );
  }
}

const DateRange = styled(withTheme(withSentryRouter(BaseDateRange)))`
  display: flex;
  flex-direction: column;
  border-left: 1px solid ${p => p.theme.border};
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(2)};
  padding: ${space(0.5)} 0;
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const StyledTimePicker = styled(TimePicker)`
  && {
    margin-left: 0;
  }
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  gap: ${space(0.5)};
`;

const UtcPickerLabel = styled('label')`
  margin: 0;
  font-weight: ${p => p.theme.fontWeightNormal};
  color: inherit;
`;

export default DateRange;
