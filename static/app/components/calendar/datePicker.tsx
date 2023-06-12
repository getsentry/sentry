import {Calendar, CalendarProps} from 'react-date-range';

import CalendarStylesWrapper from './calendarStylesWrapper';

export interface DatePickerProps extends CalendarProps {}

function DatePicker(props: DatePickerProps) {
  return (
    <CalendarStylesWrapper>
      <Calendar {...props} />
    </CalendarStylesWrapper>
  );
}

export default DatePicker;
