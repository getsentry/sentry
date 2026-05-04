import Feature from 'sentry/components/acl/feature';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {ISSUE_TAXONOMY_CONFIG, IssueTaxonomy} from 'sentry/views/issueList/taxonomies';

const CONFIG = ISSUE_TAXONOMY_CONFIG[IssueTaxonomy.SENTRY_CONFIGURATION];
const QUERY = `is:unresolved issue.category:[${CONFIG.categories.join(',')}]`;

export default function SentryConfigurationPage() {
  const organization = useOrganization();

  return (
    <Feature features={CONFIG.featureFlag ?? []} renderDisabled>
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
    </Feature>
  );
}
