import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import type {EntryType} from 'sentry/types/event';

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
