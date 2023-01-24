import {lazy, Suspense} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';

import type {DatePickerProps} from './datePicker';
import type {DateRangePickerProps} from './dateRangePicker';

const LazyDatePicker = lazy(() => import('./datePicker'));
const LazyDateRangePicker = lazy(() => import('./dateRangePicker'));

const CalendarSuspenseWrapper: React.FC = ({children}) => {
  return (
    <Suspense
      fallback={
        <Placeholder width="342px" height="254px">
          <LoadingIndicator />
        </Placeholder>
      }
    >
      {children}
    </Suspense>
  );
};

export const DatePicker = (props: DatePickerProps) => {
  return (
    <CalendarSuspenseWrapper>
      <LazyDatePicker {...props} />
    </CalendarSuspenseWrapper>
  );
};

export const DateRangePicker = (props: DateRangePickerProps) => {
  return (
    <CalendarSuspenseWrapper>
      <LazyDateRangePicker {...props} />
    </CalendarSuspenseWrapper>
  );
};
