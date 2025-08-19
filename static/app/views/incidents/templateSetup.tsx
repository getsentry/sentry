import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

export default function IncidentHub() {
  return (
    <SentryDocumentTitle title={t('Incident Hub')}>this is the hub</SentryDocumentTitle>
  );
}
