import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
  MODULES,
} from 'sentry/views/insights/pages/backend/settings';
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

export function BackendHeader({
  module,
  headerActions,
  headerTitle,
  breadcrumbs,
  tabs,
  hideDefaultTabs,
}: Props) {
  const {slug} = useOrganization();

  const backendBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`
  );

  return (
    <DomainViewHeader
      domainBaseUrl={backendBaseUrl}
      domainTitle={BACKEND_LANDING_TITLE}
      headerTitle={headerTitle}
      additonalHeaderActions={headerActions}
      modules={MODULES}
      selectedModule={module}
      additionalBreadCrumbs={breadcrumbs}
      tabs={tabs}
      hideDefaultTabs={hideDefaultTabs}
    />
  );
}
