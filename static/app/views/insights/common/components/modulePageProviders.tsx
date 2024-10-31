import type {ComponentProps} from 'react';

import Feature from 'sentry/components/acl/feature';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {InsightEventKey} from 'sentry/utils/analytics/insightAnalyticEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/insights/common/components/noAccess';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {INSIGHTS_TITLE} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type ModuleNameStrings = `${ModuleName}`;
export type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

interface Props {
  children: React.ReactNode;
  features: ComponentProps<typeof Feature>['features'];
  moduleName: TitleableModuleNames;
  analyticEventName?: InsightEventKey;
  pageTitle?: string;
}

export function ModulePageProviders({
  moduleName,
  pageTitle,
  children,
  features,
  analyticEventName,
}: Props) {
  const organization = useOrganization();
  const moduleTitles = useModuleTitles();

  useHasDataTrackAnalytics(moduleName as ModuleName, analyticEventName);

  const moduleTitle = moduleTitles[moduleName];

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
    .filter(Boolean)
    .join(' — ');

  const defaultBody = (
    <Layout.Page>
      <Feature features={features} organization={organization} renderDisabled={NoAccess}>
        <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
      </Feature>
    </Layout.Page>
  );

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={fullPageTitle} orgSlug={organization.slug}>
        <UpsellPageHook moduleName={moduleName}>{defaultBody}</UpsellPageHook>
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

export const UpsellPageHook = HookOrDefault({
  hookName: 'component:insights-upsell-page',
  defaultComponent: ({children}) => children,
});
