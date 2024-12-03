import Feature from 'sentry/components/acl/feature';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {InsightEventKey} from 'sentry/utils/analytics/insightAnalyticEvents';
import useOrganization from 'sentry/utils/useOrganization';
import {NoAccess} from 'sentry/views/insights/common/components/noAccess';
import {useHasDataTrackAnalytics} from 'sentry/views/insights/common/utils/useHasDataTrackAnalytics';
import {useModuleTitles} from 'sentry/views/insights/common/utils/useModuleTitle';
import {
  INSIGHTS_TITLE,
  MODULE_FEATURE_MAP,
  QUERY_DATE_RANGE_LIMIT,
} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type ModuleNameStrings = `${ModuleName}`;
export type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

interface Props {
  children: React.ReactNode;
  moduleName: TitleableModuleNames;
  analyticEventName?: InsightEventKey;
  pageTitle?: string;
}

export function ModulePageProviders({
  moduleName,
  pageTitle,
  children,
  analyticEventName,
}: Props) {
  const organization = useOrganization();
  const moduleTitles = useModuleTitles();

  const hasDateRangeQueryLimit = organization.features.includes(
    'insights-query-date-range-limit'
  );

  const features = MODULE_FEATURE_MAP[moduleName];

  useHasDataTrackAnalytics(moduleName as ModuleName, analyticEventName);

  const moduleTitle = moduleTitles[moduleName];

  const fullPageTitle = [pageTitle, moduleTitle, INSIGHTS_TITLE]
    .filter(Boolean)
    .join(' — ');

  return (
    <PageFiltersContainer
      maxPickableDays={hasDateRangeQueryLimit ? QUERY_DATE_RANGE_LIMIT : undefined}
    >
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
