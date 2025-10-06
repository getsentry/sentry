import {TAXONOMY_DEFAULT_QUERY} from 'sentry/constants';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

import {DEFAULT_QUERY} from './utils';

export function OverviewWrapper() {
  const location = useLocation();
  const shouldFetchOnMount = !defined(location.query.new);
  const organization = useOrganization();

  const title = t('Feed');

  const defaultQuery = organization.features.includes('issue-taxonomy')
    ? TAXONOMY_DEFAULT_QUERY
    : DEFAULT_QUERY;

  return (
    <IssueListContainer title={title}>
      <IssueListOverview
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
        initialQuery={defaultQuery}
      />
    </IssueListContainer>
  );
}
