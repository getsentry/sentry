import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Redirect from 'sentry/components/redirect';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import {MonitorsDropdown} from 'sentry/views/issueList/monitorsDropdown';
import IssueListOverview from 'sentry/views/issueList/overview';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

type Props = RouteComponentProps;

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.ERRORS_AND_OUTAGES];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

export default function ErrorsOutagesPage(props: Props) {
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
            {...props}
            initialQuery={QUERY}
            title={CONFIG.label}
            titleDescription={CONFIG.description}
            headerActions={<MonitorsDropdown />}
          />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
