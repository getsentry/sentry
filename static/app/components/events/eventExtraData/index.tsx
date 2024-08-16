import {memo, useState} from 'react';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {getKnownData, getKnownStructuredData} from '../contexts/utils';

import {getEventExtraDataKnownDataDetails} from './getEventExtraDataKnownDataDetails';
import type {EventExtraData as TEventExtraData, EventExtraDataType} from './types';

type Props = {
  event: Event;
};

export const EventExtraData = memo(
  ({event}: Props) => {
    const [raw, setRaw] = useState(false);

    if (isEmptyObject(event.context)) {
      return null;
    }
    let contextBlock: React.ReactNode = null;
    if (defined(event.context)) {
      const knownData = getKnownData<TEventExtraData, EventExtraDataType>({
        data: event.context,
        knownDataTypes: Object.keys(event.context),
        meta: event._meta?.context,
        onGetKnownDataDetails: v => getEventExtraDataKnownDataDetails(v),
      });
      const formattedKnownData = raw
        ? knownData
        : getKnownStructuredData(knownData, event._meta?.context);
      contextBlock = <ContextBlock data={formattedKnownData} raw={raw} />;
    }

    return (
      <InterimSection
        type={SectionKey.EXTRA}
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
        {contextBlock}
      </InterimSection>
    );
  },
  (prevProps: Props, nextProps: Props) => prevProps.event.id === nextProps.event.id
);
