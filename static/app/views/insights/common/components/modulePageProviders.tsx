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
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
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
  const {isInDomainView} = useDomainViewFilters();

  useHasDataTrackAnalytics(moduleName as ModuleName, analyticEventName);

  const moduleTitle = moduleTitles[moduleName];
  const shouldUseUpsellHook = !isInDomainView;

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
    .filter(Boolean)
    .join(' — ');

  return (
    <PageFiltersContainer>
      <SentryDocumentTitle title={fullPageTitle} orgSlug={organization.slug}>
        {shouldUseUpsellHook && (
          <UpsellPageHook moduleName={moduleName}>
            <Layout.Page>
              <Feature
                features={features}
                organization={organization}
                renderDisabled={NoAccess}
              >
                <NoProjectMessage organization={organization}>
                  {children}
                </NoProjectMessage>
              </Feature>
            </Layout.Page>
          </UpsellPageHook>
        )}

        {!shouldUseUpsellHook && (
          <Layout.Page>
            <Feature
              features={['insights-entry-points']}
              organization={organization}
              renderDisabled={NoAccess}
            >
              <NoProjectMessage organization={organization}>{children}</NoProjectMessage>
            </Feature>
          </Layout.Page>
        )}
      </SentryDocumentTitle>
    </PageFiltersContainer>
  );
}

export const UpsellPageHook = HookOrDefault({
  hookName: 'component:insights-upsell-page',
  defaultComponent: ({children}) => children,
});
