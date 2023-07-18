import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {ModuleName} from 'sentry/views/starfish/types';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import SpansView from 'sentry/views/starfish/views/spans/spansView';

export default function DBModule() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={ROUTE_NAMES.database} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('Database Queries')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <PageFiltersContainer>
                <SpansView moduleName={ModuleName.DB} />
              </PageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
