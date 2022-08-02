import {Calendar, CalendarProps} from 'react-date-range';

import CalendarStylesWrapper from './calendarStylesWrapper';

export type DatePickerProps = CalendarProps;

const DateRangePicker = (props: DatePickerProps) => {
  return (
    <CalendarStylesWrapper>
      <Calendar {...props} />
    </CalendarStylesWrapper>
  );
};

export default DateRangePicker;
