import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {SidebarNavigationItemHook} from 'sentry/components/sidebar/sidebarItem';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/insights/common/components/noAccess';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {INSIGHTS_TITLE} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';
import {ModulesUpsell, sidebarIdMap} from 'sentry/views/insights/upsells/modulesUpsell';

type ModuleNameStrings = `${ModuleName}`;
export type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

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

  const defaultBody = (
    <Feature features={features} organization={organization} renderDisabled={NoAccess}>
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );

  const moduleUpsell = <ModulesUpsell selectedModule={moduleName} />;

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={fullPageTitle} orgSlug={organization.slug}>
        <Layout.Page>
          <SidebarNavigationItemHook id={sidebarIdMap[moduleName]}>
            {({disabled}) => (disabled ? moduleUpsell : defaultBody)}
          </SidebarNavigationItemHook>
        </Layout.Page>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}
