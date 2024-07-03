import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/insights/common/components/noAccess';
import {INSIGHTS_TITLE, MODULE_TITLES} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

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

  const moduleTitle = MODULE_TITLES[moduleName];

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
    .filter(Boolean)
    .join(' — ');

  const defaultBody = (
    <Feature features={features} organization={organization} renderDisabled={NoAccess}>
      <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
    </Feature>
  );

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={fullPageTitle} orgSlug={organization.slug}>
        <Layout.Page>
          <UpsellPageHook id={sidebarIdMap[moduleName]}>
            {({disabled, upsellPage}) =>
              disabled && upsellPage ? upsellPage : defaultBody
            }
          </UpsellPageHook>
        </Layout.Page>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

// This matches ids in the sidebar items and in the hook in getsentry
export const sidebarIdMap: Record<TitleableModuleNames, string> = {
  ai: 'llm-monitoring',
  'mobile-ui': 'performance-mobile-ui',
  cache: 'performance-cache',
  db: 'performance-database',
  http: 'performance-http',
  resource: 'performance-browser-resources',
  screen_load: 'performance-mobile-screens',
  app_start: 'performance-mobile-app-startup',
  vital: 'performance-webvitals',
  queue: 'performance-queues',
};

export const UpsellPageHook = HookOrDefault({
  hookName: 'insights:upsell-page',
  defaultComponent: ({children}) =>
    children({
      disabled: false,
      upsellPage: null,
    }),
});
