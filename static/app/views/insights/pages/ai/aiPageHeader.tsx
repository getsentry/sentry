import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_LANDING_SUB_PATH,
  AI_LANDING_TITLE,
} from 'sentry/views/insights/pages/ai/settings';
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
export function AiHeader({module, headerTitle, headerActions, breadcrumbs}: Props) {
  const {slug} = useOrganization();

  const aiBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/`
  );

  const modules = [ModuleName.AI];

  return (
    <DomainViewHeader
      domainBaseUrl={aiBaseUrl}
      headerTitle={headerTitle}
      domainTitle={AI_LANDING_TITLE}
      modules={modules}
      selectedModule={module}
      additonalHeaderActions={headerActions}
      additionalBreadCrumbs={breadcrumbs}
    />
  );
}
