import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function ClassifiersList() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Classifiers')} orgSlug={organization.slug}>
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: t('Classifiers')}}
      />
    </SentryDocumentTitle>
  );
}
