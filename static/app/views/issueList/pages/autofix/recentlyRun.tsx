import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

const QUERY = `is:unresolved has:issue.seer_last_run`;
const label = t('Recently Run');

export default function AutofixRecentlyRunPage() {
  const organization = useOrganization();

  return (
    <IssueListContainer title={label}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview
            initialQuery={QUERY}
            title={label}
            titleDescription={t('Issues where Seer has identified a root cause.')}
          />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
