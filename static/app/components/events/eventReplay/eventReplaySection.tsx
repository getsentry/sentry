import type {ReactNode} from 'react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';

type EventReplaySectionProps = {
  children: JSX.Element | null;
  actions?: ReactNode;
  className?: string;
};

export function EventReplaySection({
  className,
  children,
  actions,
}: EventReplaySectionProps) {
  return (
    <EventDataSection
      type="replay"
      title={t('Session Replay')}
      className={className}
      actions={actions}
    >
      {children}
    </EventDataSection>
  );
}
