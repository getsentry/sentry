import {useState} from 'react';

import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {getKnownData} from 'sentry/components/events/contexts/utils';
import {StructuredData} from 'sentry/components/structuredEventData';
import {KeyValueTableCard} from 'sentry/components/tables/keyValueTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {getEventExtraDataKnownDataDetails} from './getEventExtraDataKnownDataDetails';
import type {EventExtraDataType, EventExtraData as TEventExtraData} from './types';

type Props = {
  event: Event;
};

export function EventExtraData({event}: Props) {
  const [raw, setRaw] = useState(false);

  if (!defined(event.context) || isEmptyObject(event.context)) {
    return null;
  }

  const meta = event._meta?.context;
  const knownData = getKnownData<TEventExtraData, EventExtraDataType>({
    data: event.context,
    knownDataTypes: Object.keys(event.context),
    meta,
    onGetKnownDataDetails: v => getEventExtraDataKnownDataDetails(v),
  });

  const contentItems = knownData.map(item => ({
    item: raw
      ? item
      : {
          ...item,
          value: (
            <StructuredData
              withAnnotatedText
              value={item.value}
              maxDefaultDepth={2}
              meta={meta?.[item.key]}
            />
          ),
        },
    disableFormattedData: raw,
  }));

  return (
    <FoldSection
      sectionKey={SectionKey.EXTRA}
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
      <KeyValueTableCard contentItems={contentItems} sortAlphabetically />
    </FoldSection>
  );
}
