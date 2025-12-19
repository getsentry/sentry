import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_LANDING_SUB_PATH,
  CONVERSATIONS_SIDEBAR_LABEL,
  MODULES,
} from 'sentry/views/insights/pages/conversations/settings';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

type Props = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
  module?: HeaderProps['selectedModule'];
};

export function ConversationsPageHeader({
  module,
  headerActions,
  breadcrumbs,
  hideDefaultTabs,
}: Props) {
  const organization = useOrganization();

  const conversationsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${CONVERSATIONS_LANDING_SUB_PATH}/`
  );

  return (
    <DomainViewHeader
      domainBaseUrl={conversationsBaseUrl}
      domainTitle={CONVERSATIONS_SIDEBAR_LABEL}
      modules={MODULES}
      selectedModule={module}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
      hideDefaultTabs={hideDefaultTabs}
      hasOverviewPage={false}
      unified
    />
  );
}
