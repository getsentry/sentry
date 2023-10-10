import type {CalendarProps, DateRangeProps, Range, RangeKeyDict} from 'react-date-range';
import format from 'date-fns/format';

/**
 * Auto-mock of the react-date-range library for jest
 *
 * We mock out these components in tests because they are heavy (causes timeouts),
 * difficult to interact with, and we don't need to validate their behavior.
 *
 * If your test is dependent on this library's functionality, you may unmock with
 * jest.unmock('react-date-range')
 */

type DatePickerInputProps = {
  'data-test-id': string;
  date?: Date;
  onChange?: (date: Date) => void;
};

type DateRangeInputsProps = {
  onChange: (range: Range) => void;
  range: Range;
};

function DatePickerInput({date, onChange, ...props}: DatePickerInputProps) {
  return (
    <input
      type="date"
      value={date ? format(date, 'yyyy-MM-dd') : ''}
      onChange={e => {
        const newDate = new Date(e.target.value + 'T00:00:00');

        onChange?.(newDate);
      }}
      {...props}
    />
  );
}

/**
 * Replaces the react-date-range Calendar component with a date input
 *
 * Example usage:
 *
 * const datePicker = screen.getByTestId('date-picker')
 * fireEvent.change(datePicker, {target: {value: '2022-01-01'}})
 */
export function Calendar({date, onChange}: CalendarProps) {
  return <DatePickerInput data-test-id="date-picker" date={date} onChange={onChange} />;
}

function DateRangeInputs({range, onChange}: DateRangeInputsProps) {
  return (
    <div data-test-id={`date-range-${range.key}`}>
      <DatePickerInput
        data-test-id={`date-range-${range.key}-from`}
        date={range.startDate}
        onChange={date => {
          onChange({startDate: date, endDate: range.endDate ?? date, key: range.key});
        }}
      />
      <DatePickerInput
        data-test-id={`date-range-${range.key}-to`}
        date={range.endDate}
        onChange={date => {
          onChange({endDate: date, startDate: range.startDate ?? date, key: range.key});
        }}
      />
    </div>
  );
}

/**
 * Replaces the react-date-range DateRange component with multiple date inputs
 * Will render a pair of date inputs for each range
 *
 * Example usage:
 *
 * const datePickerFrom = screen.getByTestId(date-range-primary-from')
 * const datePickerTo = screen.getByTestId('date-range-primary-to')
 * fireEvent.change(datePickerFrom, {target: {value: '2022-01-01'}})
 * fireEvent.change(datePickerTo, {target: {value: '2022-01-02'}})
 */
export function DateRange({ranges, onChange}: DateRangeProps) {
  return (
    <div data-test-id="date-range-picker">
      {ranges?.map(range => (
        <DateRangeInputs
          range={range}
          onChange={({startDate, endDate, key}) => {
            const rangesByKey = ranges?.reduce<RangeKeyDict>(
              (acc, nextRange) => ({
                ...acc,
                [nextRange?.key ?? '']:
                  nextRange.key === key ? {...nextRange, startDate, endDate} : nextRange,
              }),
              {}
            );

            onChange?.(rangesByKey);
          }}
          key={range.key}
        />
      )) ?? null}
    </div>
  );
}
