import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_LANDING_TITLE,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {isModuleEnabled} from 'sentry/views/insights/pages/utils';
import {ModuleName} from 'sentry/views/insights/types';

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

  const hasMobileScreens = isModuleEnabled(ModuleName.MOBILE_VITALS, organization);
  const hasMobileUi = isModuleEnabled(ModuleName.MOBILE_UI, organization);

  const modules = hasMobileScreens
    ? [ModuleName.MOBILE_VITALS, ModuleName.HTTP]
    : [
        ModuleName.APP_START,
        ModuleName.SCREEN_LOAD,
        ModuleName.SCREEN_RENDERING,
        ModuleName.HTTP,
      ];

  if (!hasMobileScreens && hasMobileUi) {
    modules.push(ModuleName.MOBILE_UI);
  }

  return (
    <DomainViewHeader
      domainBaseUrl={mobileBaseUrl}
      domainTitle={MOBILE_LANDING_TITLE}
      headerTitle={headerTitle}
      modules={modules}
      selectedModule={module}
      tabs={tabs}
      hideDefaultTabs={hideDefaultTabs}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
    />
  );
}
