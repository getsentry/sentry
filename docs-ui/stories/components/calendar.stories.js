import {useState} from 'react';

import {DatePicker, DateRangePicker} from 'sentry/components/calendar';

export default {
  title: 'Components/Calendar',
};

export const _DateRangePicker = () => {
  const [range, setRange] = useState({startDate: new Date(), endDate: new Date()});

  return (
    <DateRangePicker
      onChange={newRange => {
        setRange(newRange);
      }}
      startDate={range.startDate}
      endDate={range.endDate}
    />
  );
};

_DateRangePicker.storyName = 'DateRangePicker';
_DateRangePicker.parameters = {
  docs: {
    description: {
      story: 'Calendar widget for selecting a date range. Uses react-date-range',
    },
  },
};

export const _DatePicker = () => {
  const [date, setDate] = useState(() => new Date());

  return <DatePicker date={date} onChange={setDate} />;
};

_DatePicker.storyName = 'DatePicker';
_DatePicker.parameters = {
  docs: {
    description: {
      story: 'Calendar widget for selecting a single date. Uses react-date-range',
    },
  },
};
