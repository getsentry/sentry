import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import KeyValueList from './interfaces/keyValueList';

type Props = {
  event: Event;
};

function DeviceInterface({event}: Props) {
  const data = event.device ?? {};
  const extras = Object.entries<any>(data.data ?? {}).map(([key, value]) => ({
    key,
    value,
    subject: key,
    isContextData: true,
  }));

  return (
    <EventDataSection type="device" title={t('Device')} wrapTitle>
      <KeyValueList
        isSorted={false}
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

export default DeviceInterface;
