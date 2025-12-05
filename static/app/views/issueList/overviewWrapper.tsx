import styled from '@emotion/styled';

import {TAXONOMY_DEFAULT_QUERY} from 'sentry/constants';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

export function OverviewWrapper() {
  const location = useLocation();
  const shouldFetchOnMount = !defined(location.query.new);

  const title = t('Feed');

  return (
    <IssueListContainer title={title}>
      <Subtitle>Hello</Subtitle>
      <IssueListOverview
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
        initialQuery={TAXONOMY_DEFAULT_QUERY}
      />
    </IssueListContainer>
  );
}

const Subtitle = styled('div')`
  font-size: 0.9em;
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
`;
