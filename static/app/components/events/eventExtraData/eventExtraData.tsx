import {memo, useState} from 'react';

import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import EventDataContent from './eventDataContent';

type Props = {
  event: Event;
};

const EventExtraData = memo(
  ({event}: Props) => {
    const [raw, setRaw] = useState(false);
    return (
      <EventDataSection
        type="extra"
        title={t('Additional Data')}
        toggleRaw={() => setRaw(!raw)}
        raw={raw}
      >
        <EventDataContent raw={raw} data={event.context} />
      </EventDataSection>
    );
  },
  (prevProps: Props, nextProps: Props) => prevProps.event.id !== nextProps.event.id
);

export default EventExtraData;
