import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import {DetectorsLink} from 'sentry/views/issueList/detectorsLink';
import IssueListOverview from 'sentry/views/issueList/overview';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.BREACHED_METRICS];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

function HeaderMonitorsLink() {
  const organization = useOrganization();

  if (!organization.features.includes('workflow-engine-ui')) {
    return null;
  }

  return <DetectorsLink detectorTypes={['metric_issue']} />;
}

export default function RegressionsPage() {
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
