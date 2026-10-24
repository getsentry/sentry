import {useId, useState} from 'react';
import type {Range} from 'react-date-range';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Checkbox} from '@sentry/scraps/checkbox';

import {DateRangePicker} from 'sentry/components/calendar';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getEndOfDay,
  getStartOfPeriodAgo,
  isValidTime,
  setDateToTime,
} from 'sentry/utils/dates';
import {getRouteStringFromRoutes} from 'sentry/utils/getRouteStringFromRoutes';
import {useRoutes} from 'sentry/utils/useRoutes';

import {TimePicker} from './timePicker';

const getTimeStringFromDate = (date: Date) => moment(date).local().format('HH:mm');

type ChangeData = {end?: Date; hasDateRangeErrors?: boolean; start?: Date};

type Props = {
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

  className?: string;

  /**
   * The largest date range (ie. end date - start date) allowed
   */
  maxDateRange?: number;

  /**
   * The maximum number of days in the past you can pick
   */
  maxPickableDays?: number;

  /**
   * Just used for metrics
   */
  organization?: Organization;

  showAbsolute?: boolean;

  showRelative?: boolean;

  /**
   * Should we have a time selector?
   */
  showTimePicker?: boolean;

  /**
   * Use UTC
   */
  utc?: boolean | null;
};

function BaseDateRange({
  className,
  start: startProp,
  end: endProp,
  onChange,
  onChangeUtc,
  organization,
  maxDateRange,
  maxPickableDays = MAX_PICKABLE_DAYS,
  showTimePicker,
  utc,
}: Props) {
  const routes = useRoutes();
  const utcInputId = useId();
  const [hasStartErrors, setHasStartErrors] = useState(false);
  const [hasEndErrors, setHasEndErrors] = useState(false);
  // Capture "now" once on mount so render stays pure. Can't select dates in the future.
  const [now] = useState(() => new Date());

  const handleSelectDateRange = (range: Range) => {
    const {startDate, endDate} = range;
    const newEnd = endDate ? getEndOfDay(endDate) : endDate;

    onChange({
      start: startDate,
      end: newEnd,
    });
  };

  const handleChangeStart = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Safari does not support "time" inputs, so we don't have access to
    // `e.target.valueAsDate`, must parse as string
    //
    // Time will be in 24hr e.g. "21:00"
    const currentStart = startProp ?? '';
    const currentEnd = endProp ?? undefined;
    const startTime = e.target.value;
    const newStartTime = setDateToTime(currentStart, startTime, {local: true});

    if (
      !startTime ||
      !isValidTime(startTime) ||
      (currentEnd && newStartTime > currentEnd)
    ) {
      setHasStartErrors(true);
      onChange({hasDateRangeErrors: true});
      return;
    }

    trackAnalytics('dateselector.time_changed', {
      organization: organization ?? null,
      field_changed: 'start',
      time: startTime,
      path: getRouteStringFromRoutes({routes}),
    });

    onChange({
      start: newStartTime,
      end: currentEnd,
      hasDateRangeErrors: hasEndErrors,
    });

    setHasStartErrors(false);
  };

  const handleChangeEnd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentStart = startProp ?? undefined;
    const currentEnd = endProp ?? '';
    const endTime = e.target.value;
    const newEndTime = setDateToTime(currentEnd, endTime, {local: true});

    if (
      !endTime ||
      !isValidTime(endTime) ||
      (currentStart && currentStart > newEndTime)
    ) {
      setHasEndErrors(true);
      onChange({hasDateRangeErrors: true});
      return;
    }

    trackAnalytics('dateselector.time_changed', {
      organization: organization ?? null,
      field_changed: 'end',
      time: endTime,
      path: getRouteStringFromRoutes({routes}),
    });

    onChange({
      start: currentStart,
      end: newEndTime,
      hasDateRangeErrors: hasStartErrors,
    });

    setHasEndErrors(false);
  };

  const start = startProp ?? '';
  const end = endProp ?? '';

  const startTime = getTimeStringFromDate(new Date(start));
  const endTime = getTimeStringFromDate(new Date(end));

  // Restraints on the time range that you can select
  // Can't select dates in the future b/c we're not fortune tellers (yet)
  //
  // We want `maxPickableDays` - 1 (if today is Jan 5, max is 3 days, the minDate should be Jan 3)
  // Subtract additional day  because we force the end date to be inclusive,
  // so when you pick Jan 1 the time becomes Jan 1 @ 23:59:59,
  // (or really, Jan 2 @ 00:00:00 - 1 second), while the start time is at 00:00
  let minDate = getStartOfPeriodAgo('days', maxPickableDays - 1);

  let maxDate = now;

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
        onChange={handleSelectDateRange}
      />
      {showTimePicker && (
        <TimeAndUtcPicker>
          <StyledTimePicker
            start={startTime}
            end={endTime}
            onChangeStart={handleChangeStart}
            onChangeEnd={handleChangeEnd}
            hasStartErrors={hasStartErrors}
            hasEndErrors={hasEndErrors}
          />
          <UtcPicker>
            <Checkbox onChange={onChangeUtc} checked={utc || false} id={utcInputId} />
            <UtcPickerLabel htmlFor={utcInputId}>{t('UTC')}</UtcPickerLabel>
          </UtcPicker>
        </TimeAndUtcPicker>
      )}
    </div>
  );
}

export const DateRange = styled(BaseDateRange)`
  display: flex;
  flex-direction: column;
  border-left: 1px solid ${p => p.theme.tokens.border.primary};
`;

const TimeAndUtcPicker = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${p => p.theme.space.xl};
  padding: ${p => p.theme.space.xs} 0;
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const StyledTimePicker = styled(TimePicker)`
  && {
    margin-left: 0;
  }
`;

const UtcPicker = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 1;
  gap: ${p => p.theme.space.xs};
`;

const UtcPickerLabel = styled('label')`
  margin: 0;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: inherit;
`;
