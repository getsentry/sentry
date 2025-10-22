import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Redirect from 'sentry/components/redirect';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import {DetectorsLink} from 'sentry/views/issueList/detectorsLink';
import {MonitorsDropdown} from 'sentry/views/issueList/monitorsDropdown';
import IssueListOverview from 'sentry/views/issueList/overview';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.ERRORS_AND_OUTAGES];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

const DETECTOR_TYPES: DetectorType[] = [
  'error',
  'monitor_check_in_failure',
  'uptime_domain_failure',
];

function HeaderMonitorsLink() {
  const organization = useOrganization();

  if (organization.features.includes('workflow-engine-ui')) {
    return <DetectorsLink detectorTypes={DETECTOR_TYPES} />;
  }

  // This links to the old crons/uptime pages
  // Can be removed once workflow-engine-ui is GA'd
  return <MonitorsDropdown />;
}

export default function ErrorsOutagesPage() {
  const organization = useOrganization();

  const hasIssueTaxonomy = organization.features.includes('issue-taxonomy');
  if (!hasIssueTaxonomy) {
    return <Redirect to={`/organizations/${organization.slug}/issues/`} />;
  }

  return (
    <IssueListContainer title={CONFIG.label}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview
            initialQuery={QUERY}
            title={CONFIG.label}
            titleDescription={CONFIG.description}
            headerActions={<HeaderMonitorsLink />}
          />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
