import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {defined} from 'sentry/utils';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';
import {useHasIssueViewSharing} from 'sentry/views/nav/usePrefersStackedNav';

type OverviewWrapperProps = RouteComponentProps<
  Record<PropertyKey, string | undefined>,
  {searchId?: string}
>;

export function OverviewWrapper(props: OverviewWrapperProps) {
  const shouldFetchOnMount = !defined(props.location.query.new);
  const hasIssueViewSharing = useHasIssueViewSharing();

  const title = hasIssueViewSharing ? t('Feed') : t('Issues');

  return (
    <IssueListContainer title={title}>
      <IssueListOverview
        {...props}
        shouldFetchOnMount={shouldFetchOnMount}
        title={title}
      />
    </IssueListContainer>
  );
}
