import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function Inbox() {
  const organization = useOrganization();

  if (!organization.features.includes('universal-inbox')) {
    return <NotFound />;
  }

  return (
    <SentryDocumentTitle title={t('Inbox')} orgSlug={organization.slug}>
      <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: t('Inbox')}} />
    </SentryDocumentTitle>
  );
}
