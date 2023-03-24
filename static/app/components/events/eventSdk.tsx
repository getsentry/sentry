import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import KeyValueList from './interfaces/keyValueList';
import {AnnotatedText} from './meta/annotatedText';

type Props = {
  meta?: Record<any, any>;
  sdk?: Event['sdk'];
};

export function EventSdk({sdk, meta}: Props) {
  if (!sdk || objectIsEmpty(sdk)) {
    return null;
  }

  return (
    <EventDataSection type="sdk" title={t('SDK')}>
      <KeyValueList
        data={[
          {
            key: 'name',
            subject: t('Name'),
            value: (
              <pre className="val-string">
                {meta?.name?.[''] ? (
                  <AnnotatedText value={sdk.name} meta={meta?.name?.['']} />
                ) : (
                  sdk.name
                )}
              </pre>
            ),
          },
          {
            key: 'version',
            subject: t('Version'),
            value: (
              <pre className="val-string">
                {meta?.version?.[''] ? (
                  <AnnotatedText value={sdk.version} meta={meta?.version?.['']} />
                ) : (
                  sdk.version
                )}
              </pre>
            ),
          },
        ]}
      />
    </EventDataSection>
  );
}
