import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/performance/database/noAccess';

interface Props {
  children: React.ReactNode;
  features: ComponentProps<typeof Feature>['features'];
  title: string;
}

export function ModulePageProviders({title, children, features}: Props) {
  const organization = useOrganization();

  return (
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
  );
}
