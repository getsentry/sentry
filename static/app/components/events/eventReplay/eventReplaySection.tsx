import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';

type EventReplaySectionProps = {children: JSX.Element; className?: string};

export function EventReplaySection({className, children}: EventReplaySectionProps) {
  return (
    <EventDataSection type="replay" title={t('Session Replay')} className={className}>
      {children}
    </EventDataSection>
  );
}
