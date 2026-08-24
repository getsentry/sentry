import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DomainViewHeader,
  type Props as HeaderProps,
} from 'sentry/views/insights/pages/domainViewHeader';
import {
  MCP_LANDING_SUB_PATH,
  MCP_SIDEBAR_LABEL,
  MODULES,
} from 'sentry/views/insights/pages/mcp/settings';
import {DOMAIN_VIEW_BASE_URL} from 'sentry/views/insights/pages/settings';

type Props = {
  module?: HeaderProps['selectedModule'];
};

export function MCPPageHeader({module}: Props) {
  const organization = useOrganization();

  const agentsBaseUrl = normalizeUrl(
    `/organizations/${organization.slug}/${DOMAIN_VIEW_BASE_URL}/${MCP_LANDING_SUB_PATH}/`
  );

  return (
    <DomainViewHeader
      domainBaseUrl={agentsBaseUrl}
      domainTitle={MCP_SIDEBAR_LABEL}
      modules={MODULES}
      selectedModule={module}
    />
  );
}
