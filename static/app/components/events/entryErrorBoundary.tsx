import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import type {EntryType} from 'sentry/types/event';

import {EventDataSection} from './eventDataSection';

export function EntryErrorBoundary({
  children,
  type,
}: {
  children: React.ReactNode;
  type: EntryType;
}) {
  return (
    <ErrorBoundary
      customComponent={() => (
        <EventDataSection type={type} title={type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
