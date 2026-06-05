import {TAXONOMY_DEFAULT_QUERY} from 'sentry/constants';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {IssueListContainer} from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

export function OverviewWrapper() {
  const location = useLocation();
  const shouldFetchOnMount = location.query.new == null;

  const title = t('Feed');

  return (
    <IssueListContainer title={title}>
      <IssueListOverview
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
        initialQuery={TAXONOMY_DEFAULT_QUERY}
      />
    </IssueListContainer>
  );
}
