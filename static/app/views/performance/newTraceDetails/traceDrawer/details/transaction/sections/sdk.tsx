import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

import {type SectionCardKeyValueList, TraceDrawerComponents} from '../../styles';

export function hasSDKContext(event: EventTransaction) {
  return !!event.sdk && !isEmptyObject(event.sdk);
}

export function Sdk({event}: {event: EventTransaction}) {
  if (!event.sdk || isEmptyObject(event.sdk)) {
    return null;
  }

  const meta = event._meta?.sdk;
  const items: SectionCardKeyValueList = [
    {
      key: 'name',
      subject: 'Name',
      value: meta?.name?.[''] ? (
        <AnnotatedText value={event.sdk.name} meta={meta?.name?.['']} />
      ) : (
        event.sdk.name
      ),
    },
    {
      key: 'version',
      subject: 'Version',
      value: meta?.version?.[''] ? (
        <AnnotatedText value={event.sdk.version} meta={meta?.version?.['']} />
      ) : (
        event.sdk.version
      ),
    },
  ];

  return (
    <TraceDrawerComponents.SectionCard
      items={items}
      title={t('SDK')}
      sortAlphabetically
    />
  );
}
