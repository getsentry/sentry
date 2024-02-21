import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/performance/database/noAccess';
import {RoutingContextProvider} from 'sentry/views/starfish/utils/routingContext';

interface Props {
  baseURL: string;
  children: React.ReactNode;
  features: string;
  title: string;
}

export function ModulePageProviders({title, children, features, baseURL}: Props) {
  const organization = useOrganization();

  return (
    <RoutingContextProvider value={{baseURL: baseURL}}>
      <PageFiltersContainer>
        <SentryDocumentTitle title={title} orgSlug={organization.slug}>
          <Layout.Page>
            <Feature
              features={features}
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
