import type {Crumb} from 'sentry/components/breadcrumbs';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {DomainViewHeader} from 'sentry/views/insights/pages/domainViewHeader';
import {
  MOBILE_LANDING_SUB_PATH,
  MOBILE_LANDING_TITLE,
} from 'sentry/views/insights/pages/mobile/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  breadcrumbs?: Crumb[];
  headerActions?: React.ReactNode;
  headerTitle?: React.ReactNode;
  hideDefaultTabs?: boolean;
  module?: ModuleName;
  tabs?: {onTabChange: (key: string) => void; tabList: React.ReactNode; value: string};
};

// TODO - add props to append to breadcrumbs and change title
export function MobileHeader({
  module,
  hideDefaultTabs,
  headerActions,
  headerTitle,
  tabs,
  breadcrumbs,
}: Props) {
  const {slug} = useOrganization();

  const mobileBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${MOBILE_LANDING_SUB_PATH}/`
  );

  const modules = [ModuleName.MOBILE_SCREENS];

  return (
    <DomainViewHeader
      domainBaseUrl={mobileBaseUrl}
      headerTitle={headerTitle || MOBILE_LANDING_TITLE}
      modules={modules}
      selectedModule={module}
      tabs={tabs}
      hideDefaultTabs={hideDefaultTabs}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
    />
  );
}
