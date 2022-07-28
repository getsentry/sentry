import {useCallback, useMemo} from 'react';
import {DateRange, DateRangeProps, Range, RangeKeyDict} from 'react-date-range';

import {callIfFunction} from 'sentry/utils/callIfFunction';

import CalendarStylesWrapper from './calendarStylesWrapper';

export type DateRangePickerProps = Omit<DateRangeProps, 'ranges' | 'onChange'> & {
  onChange: (range: Range) => void;
  endDate?: Date;
  startDate?: Date;
};

type RangeSelection = {primary: Range};

const PRIMARY_RANGE_KEY = 'primary';

function isRangeSelection(rangesByKey: RangeKeyDict): rangesByKey is RangeSelection {
  return rangesByKey?.[PRIMARY_RANGE_KEY] !== undefined;
}

const DateRangePicker = (props: DateRangePickerProps) => {
  const onChange = useCallback(
    (rangesByKey: RangeKeyDict) => {
      if (!isRangeSelection(rangesByKey)) {
        return;
      }

      callIfFunction(props.onChange, rangesByKey[PRIMARY_RANGE_KEY]);
    },
    [props.onChange]
  );

  const ranges: Range[] = useMemo(() => {
    return [{startDate: props.startDate, endDate: props.endDate, key: PRIMARY_RANGE_KEY}];
  }, [props.endDate, props.startDate]);

  return (
    <CalendarStylesWrapper>
      <DateRange {...props} onChange={onChange} ranges={ranges} />
    </CalendarStylesWrapper>
  );
};

export default DateRangePicker;
