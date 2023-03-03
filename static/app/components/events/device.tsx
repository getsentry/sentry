import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import KeyValueList from './interfaces/keyValueList';

type Props = {
  event: Event;
};

export function EventDevice({event}: Props) {
  const data = event.device ?? {};
  const extras = Object.entries<any>(data.data ?? {}).map(([key, value]) => ({
    key,
    value,
    subject: key,
    isContextData: true,
  }));

  if (objectIsEmpty(event.device)) {
    return null;
  }

  return (
    <EventDataSection type="device" title={t('Device')}>
      <KeyValueList
        shouldSort={false}
        data={[
          {
            key: 'name',
            subject: t('Name'),
            value: data.name,
          },
          {
            key: 'version',
            subject: t('Version'),
            value: data.version,
          },
          {
            key: 'build',
            subject: t('Build'),
            value: data.build,
          },
          ...extras,
        ]}
      />
    </EventDataSection>
  );
}
