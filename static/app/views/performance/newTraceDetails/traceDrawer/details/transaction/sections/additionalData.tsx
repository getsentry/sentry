import {useState} from 'react';
import styled from '@emotion/styled';

import {getKnownData} from 'sentry/components/events/contexts/utils';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

enum EventExtraDataType {
  CRASHED_PROCESS = 'crashed_process',
}

type TEventExtraData = {
  [key: string]: any;
};

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

export function hasAdditionalData(event: EventTransaction) {
  return !!event.context && !isEmptyObject(event.context);
}

export function AdditionalData({event}: {event: EventTransaction}) {
  const [raw, setRaw] = useState(false);

  if (!defined(event.context) || isEmptyObject(event.context)) {
    return null;
  }

  const knownData = getKnownData<TEventExtraData, EventExtraDataType>({
    data: event.context,
    knownDataTypes: Object.keys(event.context),
    meta: event._meta?.context,
    onGetKnownDataDetails: v => getEventExtraDataKnownDataDetails(v),
  });

  const formattedDataItems: SectionCardKeyValueList = raw
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
              meta={event._meta?.context}
            />
          ),
        };
      });

  const title = (
    <Title>
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
    </Title>
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

const Title = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
