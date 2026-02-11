import {useState} from 'react';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import ContextBlock from 'sentry/components/events/contexts/contextBlock';
import {
  getKnownData,
  getKnownStructuredData,
} from 'sentry/components/events/contexts/utils';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {getEventExtraDataKnownDataDetails} from './getEventExtraDataKnownDataDetails';
import type {EventExtraDataType, EventExtraData as TEventExtraData} from './types';

type Props = {
  event: Event;
};

export function EventExtraData({event}: Props) {
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
          <SegmentedControl.Item key="formatted">{t('Formatted')}</SegmentedControl.Item>
          <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
        </SegmentedControl>
      }
    >
      {contextBlock}
    </InterimSection>
  );
}
