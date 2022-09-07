import EventDataSection from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types/event';

import {AnnotatedText} from './meta/annotatedText';

type Props = {
  sdk: NonNullable<Event['sdk']>;
  meta?: Record<any, any>;
};

export function EventSdk({sdk, meta}: Props) {
  return (
    <EventDataSection type="sdk" title={t('SDK')}>
      <table className="table key-value">
        <tbody>
          <tr key="name">
            <td className="key">{t('Name')}</td>
            <td className="value">
              <pre className="val-string">
                {meta?.name?.[''] ? (
                  <AnnotatedText value={sdk.name} meta={meta?.name?.['']} />
                ) : (
                  sdk.name
                )}
              </pre>
            </td>
          </tr>
          <tr key="version">
            <td className="key">{t('Version')}</td>
            <td className="value">
              <pre className="val-string">
                {meta?.version?.[''] ? (
                  <AnnotatedText value={sdk.version} meta={meta?.version?.['']} />
                ) : (
                  sdk.version
                )}
              </pre>
            </td>
          </tr>
        </tbody>
      </table>
    </EventDataSection>
  );
}
