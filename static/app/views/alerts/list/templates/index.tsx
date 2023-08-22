import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import AlertHeader from '../header';

function AlertTemplateList() {
  const organization = useOrganization();
  const router = useRouter();
  return (
    <SentryDocumentTitle title={t('Alert Templates')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="templates" />
        <Layout.Body>
          <Layout.Main fullWidth>testing templates</Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default AlertTemplateList;
