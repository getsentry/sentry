import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import IssueListContainer from 'sentry/views/issueList';
import IssueListOverview from 'sentry/views/issueList/overview';

type OverviewWrapperProps = RouteComponentProps<
  Record<PropertyKey, string | undefined>,
  {searchId?: string}
>;

export function OverviewWrapper(props: OverviewWrapperProps) {
  const shouldFetchOnMount = !props.location.query.new;

  return (
    <IssueListContainer>
      <IssueListOverview {...props} shouldFetchOnMount={shouldFetchOnMount} />
    </IssueListContainer>
  );
}
