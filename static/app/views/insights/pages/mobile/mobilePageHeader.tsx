import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_LANDING_TITLE,
  MODULES,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

type Props = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  headerTitle?: HeaderProps['headerTitle'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
  module?: HeaderProps['selectedModule'];
  tabs?: HeaderProps['tabs'];
};

export function MobileHeader({
  module,
  hideDefaultTabs,
  headerActions,
  headerTitle,
  tabs,
  breadcrumbs,
}: Props) {
  const organization = useOrganization();

  const mobileBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}/`
  );

  return (
    <DomainViewHeader
      domainBaseUrl={mobileBaseUrl}
      domainTitle={MOBILE_LANDING_TITLE}
      headerTitle={headerTitle}
      modules={MODULES}
      selectedModule={module}
      tabs={tabs}
      hideDefaultTabs={hideDefaultTabs}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
    />
  );
}
