import type {CalendarProps} from 'react-date-range';
import {Calendar} from 'react-date-range';

import CalendarStylesWrapper from './calendarStylesWrapper';

export type DatePickerProps = CalendarProps;

const DatePicker = (props: DatePickerProps) => {
  return (
    <CalendarStylesWrapper>
      <Calendar {...props} />
    </CalendarStylesWrapper>
  );
};

export default DatePicker;
