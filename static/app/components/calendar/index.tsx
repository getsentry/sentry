import {lazy, Suspense} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';

import type {DatePickerProps} from './datePicker';
import type {DateRangePickerProps} from './dateRangePicker';

// Explicity set component type to avoid complex React.lazy type
const LazyDatePicker: React.FC<DatePickerProps> = lazy(() => import('./datePicker'));
const LazyDateRangePicker: React.FC<DateRangePickerProps> = lazy(
  () => import('./dateRangePicker')
);

function CalendarSuspenseWrapper({children}: {children: React.ReactNode}) {
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
}

export function DatePicker(props: DatePickerProps) {
  return (
    <CalendarSuspenseWrapper>
      <LazyDatePicker {...props} />
    </CalendarSuspenseWrapper>
  );
}

export function DateRangePicker(props: DateRangePickerProps) {
  return (
    <CalendarSuspenseWrapper>
      <LazyDateRangePicker {...props} />
    </CalendarSuspenseWrapper>
  );
}
