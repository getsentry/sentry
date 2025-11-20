import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.WARNINGS];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

export default function WarningsPage() {
  const organization = useOrganization();

  return (
    <IssueListContainer title={CONFIG.label}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview
            initialQuery={QUERY}
            title={CONFIG.label}
            titleDescription={CONFIG.description}
          />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
