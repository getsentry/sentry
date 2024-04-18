import {Fragment} from 'react';

import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {MODULE_TITLE, RELEASE_LEVEL} from 'sentry/views/performance/queues/settings';

function QueuesLandingPage() {
  const organization = useOrganization();

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Performance'),
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: MODULE_TITLE,
              },
            ]}
          />

          <Layout.Title>
            {MODULE_TITLE}
            <FeatureBadge type={RELEASE_LEVEL} />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />

          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function LandingPageWithProviders() {
  return (
    <ModulePageProviders
      title={[t('Performance'), MODULE_TITLE].join(' — ')}
      baseURL="/performance/queues"
      features="performance-queues-view"
    >
      <QueuesLandingPage />
    </ModulePageProviders>
  );
}
export default LandingPageWithProviders;
