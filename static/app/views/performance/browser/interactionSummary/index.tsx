import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FeatureBadge from 'sentry/components/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {PaddedContainer} from 'sentry/views/performance/browser/interactionsLandingPage';
import {InteractionBreakdownChart} from 'sentry/views/performance/browser/interactionSummary/interactionBreakdownChart';
import InteractionSampleTable from 'sentry/views/performance/browser/interactionSummary/sampleTable';
import {getActionName} from 'sentry/views/performance/browser/interactionTable';
import {
  BrowserStarfishFields,
  useBrowserModuleFilters,
} from 'sentry/views/performance/browser/useBrowserFilters';
import {ModulePageProviders} from 'sentry/views/performance/database/modulePageProviders';

function InteractionSummary() {
  const organization = useOrganization();
  const browserFilters = useBrowserModuleFilters();

  const operation = browserFilters?.[BrowserStarfishFields.TRANSACTION_OP] ?? '';
  const page = browserFilters?.[BrowserStarfishFields.PAGE] ?? '';
  const element = browserFilters?.[BrowserStarfishFields.COMPONENT] ?? '';

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
                to: normalizeUrl(
                  `/organizations/${organization.slug}/performance/browser/interactions/`
                ),
                preservePageFilters: true,
              },
              {
                label: 'Interaction Summary',
              },
            ]}
          />

          <Layout.Title>
            {getActionName(browserFilters?.['transaction.op'] || '')}
            {` ${browserFilters.component} on ${browserFilters.page}`}
            <FeatureBadge type="alpha" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <PaddedContainer>
            <PageFilterBar condensed>
              <DatePageFilter />
            </PageFilterBar>
          </PaddedContainer>
          <InteractionBreakdownChart
            operation={operation}
            page={page}
            element={element}
          />
          <InteractionSampleTable />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

export default InteractionSummary;
