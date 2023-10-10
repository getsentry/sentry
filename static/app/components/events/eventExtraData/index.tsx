import {memo, useState} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import {defined, objectIsEmpty} from 'sentry/utils';

import {getKnownData} from '../contexts/utils';

import {getEventExtraDataKnownDataDetails} from './getEventExtraDataKnownDataDetails';
import {EventExtraData as TEventExtraData, EventExtraDataType} from './types';

type Props = {
  event: Event;
};

export const EventExtraData = memo(
  ({event}: Props) => {
    const [raw, setRaw] = useState(false);

    if (objectIsEmpty(event.context)) {
      return null;
    }

    return (
      <EventDataSection
        type="extra"
        title={t('Additional Data')}
        actions={
          <SegmentedControl
            aria-label={t('View')}
            size="xs"
            value={raw ? 'raw' : 'formatted'}
            onChange={key => setRaw(key === 'raw')}
          >
            <SegmentedControl.Item key="formatted">
              {t('Formatted')}
            </SegmentedControl.Item>
            <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
          </SegmentedControl>
        }
      >
        {!defined(event.context) ? null : (
          <ContextBlock
            data={getKnownData<TEventExtraData, EventExtraDataType>({
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
  (prevProps: Props, nextProps: Props) => prevProps.event.id === nextProps.event.id
);
