import Breadcrumbs from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

function InteractionsLandingPage() {
  const organization = useOrganization();

  return (
    <ModulePageProviders title={[t('Performance'), t('Interactions')].join(' — ')}>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Interactions',
              },
            ]}
          />

          <Layout.Title>
            {t('Interactions')}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth />
      </Layout.Body>
    </ModulePageProviders>
  );
}

export default InteractionsLandingPage;
