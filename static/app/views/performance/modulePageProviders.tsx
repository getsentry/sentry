import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/performance/database/noAccess';
import {useInsightsTitle} from 'sentry/views/performance/utils/useInsightsTitle';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import type {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

interface Props {
  children: React.ReactNode;
  features: ComponentProps<typeof Feature>['features'];
  moduleName: TitleableModuleNames;
  pageTitle?: string;
}

export function ModulePageProviders({moduleName, pageTitle, children, features}: Props) {
  const organization = useOrganization();

  const insightsTitle = useInsightsTitle();
  const moduleTitle = useModuleTitle(moduleName);

  const fullPageTitle = [pageTitle, moduleTitle, insightsTitle]
    .filter(Boolean)
    .join(' — ');

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={fullPageTitle} orgSlug={organization.slug}>
        <Layout.Page>
          <Feature
            features={features}
            organization={organization}
            renderDisabled={NoAccess}
          >
            <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
          </Feature>
        </Layout.Page>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}
