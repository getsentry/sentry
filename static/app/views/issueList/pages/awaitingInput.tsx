import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

const TITLE = t('Awaiting Input');
const QUERY = 'is:unresolved';

const COLUMNS: GroupListColumn[] = [
  'graph',
  'firstSeen',
  'lastSeen',
  'event',
  'users',
  'progress',
  'assignee',
];

export default function AwaitingInputPage() {
  const organization = useOrganization();

  return (
    <IssueListContainer title={TITLE}>
      <PageFiltersContainer>
        <NoProjectMessage organization={organization}>
          <IssueListOverview initialQuery={QUERY} title={TITLE} withColumns={COLUMNS} />
        </NoProjectMessage>
      </PageFiltersContainer>
    </IssueListContainer>
  );
}
