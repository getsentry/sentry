import * as React from 'react';
import type {OnChangeProps, RangeWithKey} from 'react-date-range';
import * as ReactRouter from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import Checkbox from 'app/components/checkbox';
import LoadingIndicator from 'app/components/loadingIndicator';
import TimePicker from 'app/components/organizations/timeRangeSelector/timePicker';
import Placeholder from 'app/components/placeholder';
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
import {Theme} from 'app/utils/theme';

const DateRangePicker = React.lazy(() => import('./dateRangeWrapper'));

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

type Props = ReactRouter.WithRouterProps & {
  theme: Theme;
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
} & Partial<typeof defaultProps>;

type State = {
  hasStartErrors: boolean;
  hasEndErrors: boolean;
};

class DateRange extends React.Component<Props, State> {
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
    const {onChange, organization, router} = this.props;
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
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
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
    const {organization, onChange, router} = this.props;
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
      path: getRouteStringFromRoutes(router.routes),
      org_id: parseInt(organization.id, 10),
    });

    onChange({
      start,
      end: newTime,
      hasDateRangeErrors: this.state.hasStartErrors,
    });

    this.setState({hasEndErrors: false});
  };

  render() {
    const {className, maxPickableDays, utc, showTimePicker, onChangeUtc, theme} =
      this.props;
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
    const minDate = getStartOfPeriodAgo(
      'days',
      (maxPickableDays ?? MAX_PICKABLE_DAYS) - 2
    );
    const maxDate = new Date();

    return (
      <div className={className} data-test-id="date-range">
        <React.Suspense
          fallback={
            <Placeholder width="342px" height="254px">
              <LoadingIndicator />
            </Placeholder>
          }
        >
          <DateRangePicker
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
        </React.Suspense>
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

const StyledDateRange = styled(withTheme(ReactRouter.withRouter(DateRange)))`
  display: flex;
  flex-direction: column;
  border-left: 1px solid ${p => p.theme.border};
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.gray300};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
`;

export default StyledDateRange;
