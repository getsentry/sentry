import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertHeader from 'sentry/views/alerts/list/header';

function OccurrencesPage() {
  const router = useRouter();
  const organization = useOrganization();

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Occurrences')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="occurrences" />
        <Layout.Body>
          <Layout.Main fullWidth>
            Add your content to the schedules page here!
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

export default OccurrencesPage;
