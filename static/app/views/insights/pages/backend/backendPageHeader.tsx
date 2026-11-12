import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

import {BACKEND_LANDING_SUB_PATH, BACKEND_LANDING_TITLE, MODULES} from './settings';

type Props<T extends string = string> = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  headerTitle?: HeaderProps['headerTitle'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
  module?: HeaderProps['selectedModule'];
  tabs?: HeaderProps<T>['tabs'];
};

export function BackendHeader<T extends string = string>({
  module,
  headerActions,
  headerTitle,
  breadcrumbs,
  tabs,
  hideDefaultTabs,
}: Props<T>) {
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
