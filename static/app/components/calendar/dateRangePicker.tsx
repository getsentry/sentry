import {useCallback, useMemo} from 'react';
import type {DateRangeProps, Range, RangeKeyDict} from 'react-date-range';
import {DateRange} from 'react-date-range';

import CalendarStylesWrapper from './calendarStylesWrapper';

export interface DateRangePickerProps
  extends Omit<DateRangeProps, 'ranges' | 'onChange'> {
  onChange: (range: Range) => void;
  endDate?: Date;
  startDate?: Date;
}

type RangeSelection = {primary: Range};

const PRIMARY_RANGE_KEY = 'primary';

function isRangeSelection(rangesByKey: RangeKeyDict): rangesByKey is RangeSelection {
  return rangesByKey?.[PRIMARY_RANGE_KEY] !== undefined;
}

function DateRangePicker({
  onChange: incomingOnChange,
  startDate,
  endDate,
  ...props
}: DateRangePickerProps) {
  const onChange = useCallback(
    (rangesByKey: RangeKeyDict) => {
      if (!isRangeSelection(rangesByKey)) {
        return;
      }

      incomingOnChange?.(rangesByKey[PRIMARY_RANGE_KEY]);
    },
    [incomingOnChange]
  );

  const ranges: Range[] = useMemo(() => {
    return [{startDate, endDate, key: PRIMARY_RANGE_KEY}];
  }, [endDate, startDate]);

  return (
    <CalendarStylesWrapper>
      <DateRange {...props} onChange={onChange} ranges={ranges} />
    </CalendarStylesWrapper>
  );
}

export default DateRangePicker;
