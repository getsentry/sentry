import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/backend/settings';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  headerTitle: HeaderProps['headerTitle'];
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  module?: HeaderProps['selectedModule'];
};

// TODO - add props to append to breadcrumbs and change title
export function BackendHeader({module, headerActions, headerTitle, breadcrumbs}: Props) {
  const {slug} = useOrganization();

  const backendBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`
  );
  const modules = [ModuleName.DB, ModuleName.HTTP, ModuleName.CACHE, ModuleName.QUEUE];

  return (
    <DomainViewHeader
      domainBaseUrl={backendBaseUrl}
      domainTitle={BACKEND_LANDING_TITLE}
      headerTitle={headerTitle}
      additonalHeaderActions={headerActions}
      modules={modules}
      selectedModule={module}
      additionalBreadCrumbs={breadcrumbs}
    />
  );
}
