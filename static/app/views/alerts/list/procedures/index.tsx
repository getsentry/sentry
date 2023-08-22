import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

import AlertHeader from '../header';

function AlertProcedureList() {
  const organization = useOrganization();
  const router = useRouter();
  const {data: procedures, isLoading} = useApiQuery(
    [`/organizations/${organization.slug}/alert-procedures/`],
    {staleTime: 0}
  );

  return (
    <SentryDocumentTitle title={t('Alert Procedures')} orgSlug={organization.slug}>
      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="procedures" />
        <Layout.Body>
          <Layout.Main fullWidth>testing Procedures</Layout.Main>
          {procedures && !isLoading ? <div>{JSON.stringify(procedures)}</div> : null}
        </Layout.Body>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

export default AlertProcedureList;
