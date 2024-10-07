import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AI_LANDING_SUB_PATH,
  AI_LANDING_TITLE,
} from 'sentry/views/insights/pages/ai/settings';
import {DomainViewHeader} from 'sentry/views/insights/pages/domainViewHeader';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  headerActions?: React.ReactNode;
  module?: ModuleName;
};

// TODO - add props to append to breadcrumbs and change title
export function AiHeader({module, headerActions}: Props) {
  const {slug} = useOrganization();

  const aiBaseUrl = normalizeUrl(
    `/organizations/${slug}/${DOMAIN_VIEW_BASE_URL}/${AI_LANDING_SUB_PATH}/`
  );

  const modules = [ModuleName.AI];

  return (
    <DomainViewHeader
      domainBaseUrl={aiBaseUrl}
      headerTitle={AI_LANDING_TITLE}
      modules={modules}
      selectedModule={module}
      additonalHeaderActions={headerActions}
    />
  );
}
