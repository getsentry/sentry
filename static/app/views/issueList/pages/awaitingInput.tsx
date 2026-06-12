import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

const TITLE = t('Awaiting Input');
const QUERY = 'is:unresolved';

export default function AwaitingInputPage() {
  const organization = useOrganization();

  return (
    <IssueListContainer title={TITLE}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview initialQuery={QUERY} title={TITLE} />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
