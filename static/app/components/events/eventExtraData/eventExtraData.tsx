import {memo, useState} from 'react';

import EventDataSection from 'app/components/events/eventDataSection';
import {t} from 'app/locale';
import {Event} from 'app/types/event';

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
