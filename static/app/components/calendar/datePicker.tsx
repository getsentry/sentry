import {Calendar, CalendarProps} from 'react-date-range';

import CalendarStylesWrapper from './calendarStylesWrapper';

export type DatePickerProps = CalendarProps;

function DatePicker(props: DatePickerProps) {
  return (
    <CalendarStylesWrapper>
      <Calendar {...props} />
    </CalendarStylesWrapper>
  );
}

export default DatePicker;
