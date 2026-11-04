import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getClassifiersPath} from 'sentry/views/classifiers/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function ClassifierDetail() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Classifier')} orgSlug={organization.slug}>
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: t('Classifier')}}
        items={[
          {
            type: 'link',
            label: t('Classifiers'),
            to: getClassifiersPath(organization.slug),
          },
        ]}
      />
    </SentryDocumentTitle>
  );
}
