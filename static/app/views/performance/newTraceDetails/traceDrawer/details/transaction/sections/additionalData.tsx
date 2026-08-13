import {useState} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';

import {getKnownData} from 'sentry/components/events/contexts/utils';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';

type EventExtra = EventTransaction['context'];

enum EventExtraDataType {
  CRASHED_PROCESS = 'crashed_process',
}

type TEventExtraData = Record<string, any>;

type Output = {
  subject: string;
  value?: React.ReactNode;
};

function getEventExtraDataKnownDataDetails({
  data,
  type,
}: {
  data: TEventExtraData;
  type: EventExtraDataType;
}): Output {
  switch (type) {
    case EventExtraDataType.CRASHED_PROCESS:
      return {
        subject: t('Crashed Process'),
        value: data[type],
      };
    default:
      return {
        subject: type,
        value: data[type],
      };
  }
}

export function hasAdditionalData(extra: EventExtra | undefined) {
  return !!extra && !isEmptyObject(extra);
}

export function AdditionalData({
  extra,
  meta,
}: {
  extra: EventExtra | undefined;
  meta?: Record<string, any>;
}) {
  const [raw, setRaw] = useState(false);

  if (!defined(extra) || isEmptyObject(extra)) {
    return null;
  }

  const knownData = getKnownData<TEventExtraData, EventExtraDataType>({
    data: extra,
    knownDataTypes: Object.keys(extra),
    meta,
    onGetKnownDataDetails: v => getEventExtraDataKnownDataDetails(v),
  });

  const formattedDataItems = raw
    ? knownData
    : knownData.map(data => {
        return {
          key: data.key,
          subject: data.subject,
          value: (
            <StructuredData
              withAnnotatedText
              value={data.value}
              maxDefaultDepth={2}
              meta={meta}
            />
          ),
        };
      });

  const title = (
    <Flex justify="between" align="center">
      {t('Additional Data')}
      <SegmentedControl
        aria-label={t('View')}
        size="xs"
        value={raw ? 'raw' : 'formatted'}
        onChange={key => setRaw(key === 'raw')}
      >
        <SegmentedControl.Item key="formatted">{t('Formatted')}</SegmentedControl.Item>
        <SegmentedControl.Item key="raw">{t('Raw')}</SegmentedControl.Item>
      </SegmentedControl>
    </Flex>
  );

  return (
    <TraceDrawerComponents.SectionCard
      items={formattedDataItems}
      title={title}
      sortAlphabetically
      itemProps={{disableFormattedData: raw}}
    />
  );
}
