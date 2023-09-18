import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

function DDM() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('DDM')} orgSlug={organization.slug}>
      {t('DDM')}
    </SentryDocumentTitle>
  );
}

export default DDM;
