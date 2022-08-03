import {memo, useState} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {getEventExtraDataKnownData} from './getEventExtraDataKnownData';

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
        {!defined(event.context) ? null : (
          <ContextBlock
            data={getEventExtraDataKnownData(event.context, event._meta?.context)}
            raw={raw}
          />
        )}
      </EventDataSection>
    );
  },
  (prevProps: Props, nextProps: Props) => prevProps.event.id !== nextProps.event.id
);

export default EventExtraData;
