import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';

type EventReplaySectionProps = {children: JSX.Element};

export function EventReplaySection({children}: EventReplaySectionProps) {
  return (
    <EventDataSection type="replay" title={t('Session Replay')}>
      {children}
    </EventDataSection>
  );
}
