import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import KeyValueList from './interfaces/keyValueList';
import {AnnotatedText} from './meta/annotatedText';

type Props = {
  meta?: Record<any, any>;
  sdk?: Event['sdk'];
};

export function EventSdk({sdk, meta}: Props) {
  if (!sdk || isEmptyObject(sdk)) {
    return null;
  }

  return (
    <InterimSection title={t('SDK')} type={SectionKey.SDK} initialCollapse>
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
    </InterimSection>
  );
}
