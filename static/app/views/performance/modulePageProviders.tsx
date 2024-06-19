import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/insights/common/components/noAccess';
import type {ModuleName} from 'sentry/views/insights/types';
import {INSIGHTS_TITLE} from 'sentry/views/performance/settings';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';

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

  const moduleTitle = useModuleTitle(moduleName);

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
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
