import {type ComponentProps, useEffect} from 'react';
import * as qs from 'query-string';

import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
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
  const location = useLocation();
  const navigate = useNavigate();

  const insightsTitle = useInsightsTitle(moduleName);
  const moduleTitle = useModuleTitle(moduleName);

  const fullPageTitle = [pageTitle, moduleTitle, insightsTitle]
    .filter(Boolean)
    .join(' — ');
  const areInsightsEnabled = organization?.features?.includes('performance-insights');
  const isOnInsightsRoute = location.pathname.includes(`/insights/`);

  useEffect(() => {
    // If the Insights feature is enabled, redirect users to the `/insights/` equivalent URL!
    if (areInsightsEnabled && !isOnInsightsRoute) {
      const newPathname = location.pathname.replace(/\/performance\//g, '/insights/');
      navigate(`${newPathname}?${qs.stringify(location.query)}`);
    }
  }, [
    navigate,
    location.pathname,
    location.query,
    areInsightsEnabled,
    isOnInsightsRoute,
  ]);

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
