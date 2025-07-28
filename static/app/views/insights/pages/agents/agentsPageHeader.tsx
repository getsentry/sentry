import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AGENTS_LANDING_SUB_PATH,
  getAIModuleTitle,
  MODULES,
} from 'sentry/views/insights/pages/agents/settings';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

type Props = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  headerTitle?: HeaderProps['headerTitle'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
  module?: HeaderProps['selectedModule'];
  tabs?: HeaderProps['tabs'];
};

export function AgentsPageHeader({
  module,
  headerTitle,
  headerActions,
  breadcrumbs,
  tabs,
  hideDefaultTabs,
}: Props) {
  const organization = useOrganization();

  const agentsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${AGENTS_LANDING_SUB_PATH}`
  );

  return (
    <DomainViewHeader
      hasOverviewPage={false}
      domainBaseUrl={agentsBaseUrl}
      headerTitle={headerTitle}
      domainTitle={getAIModuleTitle(organization)}
      modules={MODULES}
      selectedModule={module}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
      tabs={tabs}
      hideDefaultTabs={hideDefaultTabs}
    />
  );
}
