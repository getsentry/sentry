import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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

  if (isEmptyObject(event.device)) {
    return null;
  }

  return (
    <InterimSection type={SectionKey.DEVICE} title={t('Device')}>
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
    </InterimSection>
  );
}
