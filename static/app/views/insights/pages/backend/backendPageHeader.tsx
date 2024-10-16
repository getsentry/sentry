import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  BACKEND_LANDING_SUB_PATH,
  BACKEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/backend/settings';
import {DomainViewHeader} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  headerActions?: React.ReactNode;
  module?: ModuleName;
};

// TODO - add props to append to breadcrumbs and change title
export function BackendHeader({module, headerActions}: Props) {
  const {slug} = useOrganization();

  const backendBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${BACKEND_LANDING_SUB_PATH}/`
  );
  const modules = [ModuleName.DB, ModuleName.HTTP, ModuleName.CACHE, ModuleName.QUEUE];

  return (
    <DomainViewHeader
      domainBaseUrl={backendBaseUrl}
      domainTitle={BACKEND_LANDING_TITLE}
      headerTitle={BACKEND_LANDING_TITLE}
      additonalHeaderActions={headerActions}
      modules={modules}
      selectedModule={module}
    />
  );
}
