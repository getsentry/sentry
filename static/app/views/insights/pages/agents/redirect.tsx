import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Redirect from 'sentry/components/redirect';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

/**
 * Redirects users to the correct module based on usage of MCP or Agents in the selected projects
 * Falls back to Agents if both or none are used
 * @returns
 */
function ModuleRedirect() {
  const organization = useOrganization();
  const {projects, fetching} = useProjects();
  const pageFilters = usePageFilters();
  const selectedProject = getSelectedProjectList(
    pageFilters.selection.projects,
    projects
  );
  const isUsingAgents = selectedProject.some(
    project => project.hasInsightsAgentMonitoring
  );
  const isUsingMCP =
    hasMCPInsightsFeature(organization) &&
    selectedProject.some(project => project.hasInsightsMCP);

  if (fetching) {
    return <LoadingIndicator />;
  }

  if (!isUsingAgents && isUsingMCP) {
    return (
      <Redirect
        to={normalizeUrl(
          `/organizations/${organization.slug}/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.MCP]}/`
        )}
      />
    );
  }

  return (
    <Redirect
      to={normalizeUrl(
        `/organizations/${organization.slug}/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AGENTS]}/`
      )}
    />
  );
}

export default function RedirectWithProviders() {
  const {view} = useDomainViewFilters();
  return (
    // We need to wrap the redirect in a PageFiltersContainer to ensure that the correct projects are selected (storageNamespace)
    <PageFiltersContainer storageNamespace={view}>
      <ModuleRedirect />
    </PageFiltersContainer>
  );
}
