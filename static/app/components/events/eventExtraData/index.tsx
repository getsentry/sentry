import {memo, useState} from 'react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';

import {geKnownData} from '../contexts/utils';

import {getEventExtraDataKnownDataDetails} from './getEventExtraDataKnownDataDetails';
import {EventExtraData as TEventExtraData, EventExtraDataType} from './types';

type Props = {
  event: Event;
};

export const EventExtraData = memo(
  ({event}: Props) => {
    const [raw, setRaw] = useState(false);
    return (
      <EventDataSection
        type="extra"
        title={t('Additional Data')}
        actions={
          <ButtonBar merged active={raw ? 'raw' : 'formatted'}>
            <Button barId="formatted" size="xs" onClick={() => setRaw(false)}>
              {t('Formatted')}
            </Button>
            <Button barId="raw" size="xs" onClick={() => setRaw(true)}>
              {t('Raw')}
            </Button>
          </ButtonBar>
        }
      >
        {!defined(event.context) ? null : (
          <ContextBlock
            data={geKnownData<TEventExtraData, EventExtraDataType>({
              data: event.context,
              knownDataTypes: Object.keys(event.context),
              meta: event._meta?.context,
              raw,
              onGetKnownDataDetails: v => getEventExtraDataKnownDataDetails(v),
            })}
            raw={raw}
          />
        )}
      </EventDataSection>
    );
  },
  (prevProps: Props, nextProps: Props) => prevProps.event.id !== nextProps.event.id
);
