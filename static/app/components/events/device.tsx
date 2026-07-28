import {KeyValue} from 'sentry/components/keyValue';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

type Props = {
  event: Event;
};

export function EventDevice({event}: Props) {
  const data = event.device ?? {};
  const extras = Object.entries<any>(data.data ?? {}).map(([key, value]) => ({
    key,
    value,
    isContextData: true,
  }));

  if (isEmptyObject(event.device)) {
    return null;
  }

  return (
    <FoldSection sectionKey={SectionKey.DEVICE} title={t('Device')}>
      <KeyValue
        items={[
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
        layout="detail"
      />
    </FoldSection>
  );
}
