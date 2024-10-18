import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {
  FRONTEND_LANDING_SUB_PATH,
  FRONTEND_LANDING_TITLE,
} from 'sentry/views/insights/pages/frontend/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  breadcrumbs?: HeaderProps['additionalBreadCrumbs'];
  headerActions?: HeaderProps['additonalHeaderActions'];
  headerTitle?: HeaderProps['headerTitle'];
  hideDefaultTabs?: HeaderProps['hideDefaultTabs'];
  module?: HeaderProps['selectedModule'];
  tabs?: HeaderProps['tabs'];
};

// TODO - add props to append to breadcrumbs and change title
export function FrontendHeader({
  module,
  headerActions,
  breadcrumbs,
  headerTitle,
  hideDefaultTabs,
  tabs,
}: Props) {
  const {slug} = useOrganization();

  const frontendBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${FRONTEND_LANDING_SUB_PATH}/`
  );

  const modules = [ModuleName.VITAL, ModuleName.HTTP, ModuleName.RESOURCE];

  return (
    <DomainViewHeader
      domainBaseUrl={frontendBaseUrl}
      domainTitle={FRONTEND_LANDING_TITLE}
      modules={modules}
      tabs={tabs}
      selectedModule={module}
      additonalHeaderActions={headerActions}
      hideDefaultTabs={hideDefaultTabs}
      additionalBreadCrumbs={breadcrumbs}
      headerTitle={headerTitle || FRONTEND_LANDING_TITLE}
    />
  );
}
