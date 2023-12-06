import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/performance/database/noAccess';
import {RoutingContextProvider} from 'sentry/views/starfish/utils/routingContext';

interface Props {
  children: React.ReactNode;
  title: string;
  baseURL?: string;
}

export function ModulePageProviders({title, children, baseURL}: Props) {
  const organization = useOrganization();

  return (
    <RoutingContextProvider value={{baseURL: baseURL || '/performance/database'}}>
      <PageFiltersContainer>
        <SentryDocumentTitle title={title} orgSlug={organization.slug}>
          <Layout.Page>
            <Feature
              features="performance-database-view"
              organization={organization}
              renderDisabled={NoAccess}
            >
              {children}
            </Feature>
          </Layout.Page>
        </SentryDocumentTitle>
      </PageFiltersContainer>
    </RoutingContextProvider>
  );
}
